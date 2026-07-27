import { formatMoney } from "@/lib/coachAvailability/pricing";

/** Booked/reserved session price from venue_booking_blocks snapshot. */
export function formatBookedSessionPrice(
  amountMinor: number | null | undefined,
  currency: string | null | undefined
): string {
  const label = formatMoney(amountMinor ?? null, currency ?? null);
  if (label === "Price to be agreed with coach") {
    return "Price to be agreed with coach";
  }
  return label;
}

export function bookedSessionPriceLine(
  amountMinor: number | null | undefined,
  currency: string | null | undefined
): string {
  return `Session price: ${formatBookedSessionPrice(amountMinor, currency)}`;
}

export function currentSessionPriceLine(
  amountMinor: number | null | undefined,
  currency: string | null | undefined
): string {
  return `Current session price: ${formatMoney(amountMinor ?? null, currency ?? null)}`;
}

export function bookedSessionPriceCaption(
  amountMinor: number | null | undefined,
  currency: string | null | undefined
): string {
  return `Booked session price: ${formatBookedSessionPrice(amountMinor, currency)}`;
}
