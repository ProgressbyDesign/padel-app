/** Shared session pricing helpers (minor units, no floating DB values). */

export const SUPPORTED_CURRENCIES = ["GBP", "EUR", "SEK", "AED"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type PricingSource =
  | "default_hourly_rate"
  | "rule_override"
  | "exception_override";

export type ResolvedSlotPrice = {
  priceAmountMinor: number | null;
  currency: string | null;
  pricingSource: PricingSource | null;
};

const MAX_HOURLY_MINOR = 10_000_000; // £100,000.00
const MAX_SESSION_OVERRIDE_MINOR = 10_000_000;

export function isSupportedCurrency(
  value: string | null | undefined
): value is SupportedCurrency {
  return (
    typeof value === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}

/** Convert a user-entered decimal amount (e.g. "40.00") to minor units. */
export function parseMoneyToMinor(
  value: string,
  currency: string
): { ok: true; minor: number } | { ok: false; message: string } {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) {
    return { ok: false, message: "Enter a price amount." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      ok: false,
      message: "Enter a valid amount with up to two decimal places.",
    };
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const minor =
    Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isInteger(minor) || minor < 0) {
    return { ok: false, message: "Price cannot be negative." };
  }
  if (minor > MAX_HOURLY_MINOR) {
    return { ok: false, message: "Price is too large." };
  }
  if (!isSupportedCurrency(currency)) {
    return { ok: false, message: "Choose a supported currency." };
  }
  return { ok: true, minor };
}

export function parseOptionalMoneyPair(input: {
  currency: string;
  amount: string;
}):
  | { ok: true; currency: string | null; minor: number | null }
  | { ok: false; message: string } {
  const currency = input.currency.trim().toUpperCase();
  const amount = input.amount.trim();
  if (!currency && !amount) {
    return { ok: true, currency: null, minor: null };
  }
  if (!currency || !amount) {
    return {
      ok: false,
      message: "Currency and hourly rate must be set together, or both cleared.",
    };
  }
  if (!isSupportedCurrency(currency)) {
    return { ok: false, message: "Choose a supported currency." };
  }
  const parsed = parseMoneyToMinor(amount, currency);
  if (!parsed.ok) return parsed;
  return { ok: true, currency, minor: parsed.minor };
}

export function minorToDecimalString(minor: number | null | undefined): string {
  if (minor == null || !Number.isFinite(minor)) return "";
  return (minor / 100).toFixed(2);
}

/**
 * Hourly rate × duration → session price in minor units (rounded to nearest).
 */
export function calculateSessionPrice(
  hourlyRateMinor: number | null | undefined,
  durationMinutes: number
): number | null {
  if (
    hourlyRateMinor == null ||
    !Number.isInteger(hourlyRateMinor) ||
    hourlyRateMinor < 0 ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return null;
  }
  return Math.round((hourlyRateMinor * durationMinutes) / 60);
}

export function formatMoney(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
  locale = "en-GB"
): string {
  if (
    amountMinor == null ||
    !currency ||
    !Number.isInteger(amountMinor) ||
    !isSupportedCurrency(currency)
  ) {
    return "Price to be agreed with coach";
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: currency === "SEK" || currency === "AED" ? "code" : "symbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export function resolveSlotPrice(input: {
  durationMinutes: number;
  currency: string | null | undefined;
  defaultHourlyRateMinor: number | null | undefined;
  ruleOverrideMinor?: number | null;
  exceptionOverrideMinor?: number | null;
  fromException?: boolean;
}): ResolvedSlotPrice {
  const currency =
    typeof input.currency === "string" && isSupportedCurrency(input.currency)
      ? input.currency
      : null;

  if (
    input.fromException &&
    input.exceptionOverrideMinor != null &&
    Number.isInteger(input.exceptionOverrideMinor) &&
    input.exceptionOverrideMinor >= 0 &&
    currency
  ) {
    if (input.exceptionOverrideMinor > MAX_SESSION_OVERRIDE_MINOR) {
      return { priceAmountMinor: null, currency: null, pricingSource: null };
    }
    return {
      priceAmountMinor: input.exceptionOverrideMinor,
      currency,
      pricingSource: "exception_override",
    };
  }

  if (
    !input.fromException &&
    input.ruleOverrideMinor != null &&
    Number.isInteger(input.ruleOverrideMinor) &&
    input.ruleOverrideMinor >= 0 &&
    currency
  ) {
    if (input.ruleOverrideMinor > MAX_SESSION_OVERRIDE_MINOR) {
      return { priceAmountMinor: null, currency: null, pricingSource: null };
    }
    return {
      priceAmountMinor: input.ruleOverrideMinor,
      currency,
      pricingSource: "rule_override",
    };
  }

  const calculated = calculateSessionPrice(
    input.defaultHourlyRateMinor,
    input.durationMinutes
  );
  if (calculated != null && currency) {
    return {
      priceAmountMinor: calculated,
      currency,
      pricingSource: "default_hourly_rate",
    };
  }

  return { priceAmountMinor: null, currency: null, pricingSource: null };
}

export function validateSessionOverrideMinor(
  value: number | null
): string | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0) {
    return "Session price cannot be negative.";
  }
  if (value > MAX_SESSION_OVERRIDE_MINOR) {
    return "Session price is too large.";
  }
  return null;
}
