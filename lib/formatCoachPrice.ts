/**
 * Formats coach pricing for display. Preserves strings that already include currency.
 * Numeric-only DB values get a sensible EUR fallback until crawler stores currency metadata.
 */

const CURRENCY_PREFIX = /^from\s+/i;
const HAS_CURRENCY = /[€£$¥]|(?:^|\s)(?:AED|USD|EUR|GBP|CHF|SEK|NOK|DKK)(?:\s|$)/i;

export function formatCoachPriceDisplay(raw: unknown): string | null {
  if (raw == null) return null;

  let base: string;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    base = raw % 1 === 0 ? String(Math.round(raw)) : String(raw);
  } else {
    base = String(raw).trim();
  }
  if (!base) return null;

  if (HAS_CURRENCY.test(base)) {
    return CURRENCY_PREFIX.test(base) ? base : `From ${base}`;
  }

  const numeric = Number(base.replace(/,/g, ""));
  if (Number.isFinite(numeric) && /^[\d.,]+$/.test(base.replace(/\s/g, ""))) {
    const amount = numeric % 1 === 0 ? String(Math.round(numeric)) : numeric.toFixed(2);
    return `From €${amount}`;
  }

  return CURRENCY_PREFIX.test(base) ? base : `From ${base}`;
}
