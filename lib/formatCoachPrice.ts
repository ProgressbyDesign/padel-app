/**
 * Formats coach pricing for listing cards and profile display.
 */

const FROM_PREFIX = /^from\s+/i;
const POA_PATTERN = /^poa$|^p\.o\.a\.?$|price\s+on\s+application/i;
const HAS_CURRENCY =
  /[€£$¥]|(?:^|\s)(?:AED|USD|EUR|GBP|CHF|SEK|NOK|DKK)(?:\s|$)/i;
const HOURLY_PATTERN = /(?:\/\s*h(?:our)?s?|per\s+hour|\/\s*hr)\b/i;
const SESSION_PATTERN = /(?:\/\s*session|per\s+session|\/\s*package|per\s+package)\b/i;

export type CoachCardPriceLine = {
  text: string;
  prefix: "From" | null;
  value: string;
  isContact: boolean;
};

function stripFromPrefix(value: string): string {
  return value.replace(FROM_PREFIX, "").trim();
}

function extractAmountPart(value: string): string | null {
  const match = value.match(
    /([€£$¥]\s*[\d][\d.,]*|[\d][\d.,]*\s*(?:€|£|\$|EUR|GBP|USD|CHF|SEK|NOK|DKK))/i
  );
  if (match) return match[1].replace(/\s+/g, "").trim();

  const numericOnly = value.match(/^[\d.,]+$/);
  if (numericOnly) return `€${numericOnly[0]}`;

  return null;
}

/** Card price row: "From £X/h", "From £X/session", or "Contact directly". */
export function formatCoachCardPrice(raw: unknown): CoachCardPriceLine {
  if (raw == null) {
    return {
      text: "Contact directly",
      prefix: null,
      value: "Contact directly",
      isContact: true,
    };
  }

  let base =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(raw % 1 === 0 ? Math.round(raw) : raw)
      : String(raw).trim();

  if (!base || POA_PATTERN.test(base)) {
    return {
      text: "Contact directly",
      prefix: null,
      value: "Contact directly",
      isContact: true,
    };
  }

  base = stripFromPrefix(base);

  const isHourly = HOURLY_PATTERN.test(base);
  const amount = extractAmountPart(base);

  if (amount) {
    const suffix = isHourly ? "/h" : "/session";
    const value = `${amount}${suffix}`;
    return { text: `From ${value}`, prefix: "From", value, isContact: false };
  }

  if (HAS_CURRENCY.test(base)) {
    const cleaned = base
      .replace(SESSION_PATTERN, "")
      .replace(HOURLY_PATTERN, "")
      .trim();
    const fallbackAmount = extractAmountPart(cleaned) || cleaned;
    const value = `${fallbackAmount}/session`;
    return { text: `From ${value}`, prefix: "From", value, isContact: false };
  }

  const numeric = Number(base.replace(/,/g, ""));
  if (Number.isFinite(numeric)) {
    const rounded = numeric % 1 === 0 ? String(Math.round(numeric)) : String(numeric);
    const value = `€${rounded}/session`;
    return { text: `From ${value}`, prefix: "From", value, isContact: false };
  }

  return {
    text: "Contact directly",
    prefix: null,
    value: "Contact directly",
    isContact: true,
  };
}

/** Legacy helper — returns amount line without duplicating "From" for simple displays. */
export function formatCoachPriceDisplay(raw: unknown): string | null {
  const line = formatCoachCardPrice(raw);
  return line.isContact ? null : line.text;
}