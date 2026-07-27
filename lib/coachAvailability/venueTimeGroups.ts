import { formatMoney, isSupportedCurrency } from "@/lib/coachAvailability/pricing";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";

/** One bookable session option at a venue (coach + relationship + slot). */
export type VenueSessionOption = {
  coachId: string;
  coachName: string;
  coachImageUrl: string | null;
  coachRole: string | null;
  relationshipId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  durationMinutes: number;
  priceAmountMinor: number | null;
  currency: string | null;
  /** Management preview only — public pages never include hidden options. */
  visibility?: "public" | "hidden" | "reserved";
};

export type VenueTimeGroup = {
  startsAt: string;
  options: VenueSessionOption[];
};

export function sessionOptionKey(option: Pick<
  VenueSessionOption,
  "relationshipId" | "startsAt" | "endsAt"
>): string {
  return `${option.relationshipId}|${option.startsAt}|${option.endsAt}`;
}

export function durationMinutesFromRange(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

/** Deduplicate only on relationshipId + startsAt + endsAt. */
export function dedupeVenueSessionOptions(
  options: VenueSessionOption[]
): VenueSessionOption[] {
  const seen = new Set<string>();
  const result: VenueSessionOption[] = [];
  for (const option of options) {
    const key = sessionOptionKey(option);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(option);
  }
  return result;
}

/**
 * One time group per exact startsAt timestamp.
 * Options at the same start remain separate bookable sessions.
 */
export function groupVenueSessionsByStart(
  options: VenueSessionOption[]
): VenueTimeGroup[] {
  const map = new Map<string, VenueSessionOption[]>();
  for (const option of dedupeVenueSessionOptions(options)) {
    const list = map.get(option.startsAt) ?? [];
    list.push(option);
    map.set(option.startsAt, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startsAt, groupOptions]) => ({
      startsAt,
      options: groupOptions.sort((a, b) =>
        a.coachName.localeCompare(b.coachName, "en")
      ),
    }));
}

function formatPriceAmount(
  amountMinor: number,
  currency: string,
  locale = "en-GB"
): string {
  if (!isSupportedCurrency(currency)) {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
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

export function pricedOptions(options: VenueSessionOption[]) {
  return options.filter(
    (option) =>
      option.priceAmountMinor != null &&
      Number.isInteger(option.priceAmountMinor) &&
      option.currency &&
      isSupportedCurrency(option.currency)
  );
}

export function lowestPricedOption(
  options: VenueSessionOption[]
): VenueSessionOption | null {
  const priced = pricedOptions(options);
  if (priced.length === 0) return null;
  return priced.reduce((best, option) =>
    (option.priceAmountMinor ?? Infinity) < (best.priceAmountMinor ?? Infinity)
      ? option
      : best
  );
}

export type VenueTimeGroupSummary = {
  timeLabel: string;
  coachCountLabel: string;
  priceLine: string | null;
  accessibleName: string;
};

export function summarizeVenueTimeGroup(
  group: VenueTimeGroup,
  timezone: string
): VenueTimeGroupSummary {
  const count = group.options.length;
  const timeLabel = formatInTimeZone(group.startsAt, timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const coachCountLabel = count === 1 ? "1 coach" : `${count} coaches`;
  const lowest = lowestPricedOption(group.options);
  const priceLine =
    lowest && lowest.priceAmountMinor != null && lowest.currency
      ? count === 1
        ? formatPriceAmount(lowest.priceAmountMinor, lowest.currency)
        : `From ${formatPriceAmount(lowest.priceAmountMinor, lowest.currency)}`
      : null;

  const accessibleParts = [
    timeLabel,
    count === 1 ? "1 coach available" : `${count} coaches available`,
  ];
  if (lowest && lowest.priceAmountMinor != null && lowest.currency) {
    accessibleParts.push(
      `prices from ${formatPriceAmount(lowest.priceAmountMinor, lowest.currency)}`
    );
  }

  return {
    timeLabel,
    coachCountLabel,
    priceLine,
    accessibleName: accessibleParts.join(", "),
  };
}

export function formatSessionOptionPrice(option: VenueSessionOption): string {
  return formatMoney(option.priceAmountMinor, option.currency);
}

export function coachesInOptions(options: VenueSessionOption[]): Array<{
  coachId: string;
  coachName: string;
}> {
  const map = new Map<string, string>();
  for (const option of options) {
    if (!map.has(option.coachId)) {
      map.set(option.coachId, option.coachName);
    }
  }
  return [...map.entries()]
    .map(([coachId, coachName]) => ({ coachId, coachName }))
    .sort((a, b) => a.coachName.localeCompare(b.coachName, "en"));
}
