/**
 * Conservative "possible duplicate" detection for coach applications.
 *
 * Pure functions only (no database access) so the rules are unit-testable.
 * A match here is a prompt for the reviewing admin, never a confirmed identity:
 * the admin still decides between "Use existing profile" and "Create separate
 * coach".
 */

export type DuplicateMatchReason =
  | "same_name"
  | "similar_name"
  | "same_city"
  | "same_country"
  | "same_role";

export const DUPLICATE_MATCH_REASON_LABELS: Record<DuplicateMatchReason, string> = {
  same_name: "Same name",
  similar_name: "Similar name",
  same_city: "Same city",
  same_country: "Same country",
  same_role: "Same role",
};

export type DuplicateCoachCandidate = {
  id: string;
  name: string;
  role: string | null;
  /** "City, Country" of the coach's primary location when known. */
  primaryLocation: string | null;
  publicationStatus: string | null;
  isClaimed: boolean;
  /** True when another account already manages this coach profile. */
  managedByOtherAccount: boolean;
  reasons: DuplicateMatchReason[];
  score: number;
};

export type DuplicateApplicant = {
  fullName: string | null;
  roleLabel: string | null;
  locations: ReadonlyArray<{ city: string | null; country: string | null }>;
};

export type DuplicateCoachSource = {
  id: string;
  name: string | null;
  role: string | null;
  publicationStatus: string | null;
  isClaimed: boolean;
  managedByOtherAccount: boolean;
  locations: ReadonlyArray<{ city: string | null; country: string | null; isPrimary: boolean }>;
};

export const MAX_DUPLICATE_CANDIDATES = 3;
/** Cap on the Postgres fetch; TypeScript ranking then keeps a short list. */
export const DUPLICATE_FETCH_LIMIT = 60;
const MIN_VOWEL_WILDCARD_TOKEN_LENGTH = 5;

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeCoachName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function nameTokens(value: string | null | undefined): string[] {
  const normalized = normalizeCoachName(value);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Tokens worth searching the database with: the longest name parts first,
 * skipping initials. Used to build the candidate query (ilike per token).
 */
export function duplicateSearchTokens(fullName: string | null | undefined): string[] {
  const tokens = nameTokens(fullName).filter((token) => token.length >= 3);
  return [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, 3);
}

/**
 * ILIKE pattern that treats each vowel as any single character so an ASCII
 * search token can retrieve an accented stored name (Martin → Martín)
 * without the unaccent extension. Short tokens stay exact — `j__n` would
 * pull in too many unrelated rows.
 */
export function vowelFlexibleNameToken(token: string): string | null {
  if (token.length < MIN_VOWEL_WILDCARD_TOKEN_LENGTH) return null;
  const flexible = token.replace(/[aeiou]/g, "_");
  return flexible === token ? null : flexible;
}

/**
 * PostgREST `or` filters for the candidate fetch. Any useful token can
 * retrieve a row; TypeScript scoring decides whether it is a possible
 * duplicate.
 */
export function duplicateRetrievalFilters(fullName: string | null | undefined): string[] {
  const filters: string[] = [];
  for (const token of duplicateSearchTokens(fullName)) {
    filters.push(`name.ilike.%${token}%`);
    const flexible = vowelFlexibleNameToken(token);
    if (flexible) filters.push(`name.ilike.%${flexible}%`);
  }
  return filters;
}

function tokenSetsEqual(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((token, index) => token === sortedB[index]);
}

/**
 * Name relationship between applicant and existing coach:
 *  - "same": identical after normalisation (any token order)
 *  - "similar": shared surname (last token, >= 3 chars) plus a matching first
 *    name or first initial
 *  - null: unrelated
 */
export function compareNames(
  applicantName: string | null | undefined,
  coachName: string | null | undefined
): "same" | "similar" | null {
  const a = nameTokens(applicantName);
  const b = nameTokens(coachName);
  if (a.length === 0 || b.length === 0) return null;
  if (tokenSetsEqual(a, b)) return "same";

  const surnameA = a[a.length - 1];
  const surnameB = b[b.length - 1];
  if (surnameA.length < 3 || surnameA !== surnameB) return null;

  const firstA = a[0];
  const firstB = b[0];
  if (a.length === 1 || b.length === 1) return null;
  if (firstA === firstB || firstA[0] === firstB[0]) return "similar";
  return null;
}

function normalizedPlace(value: string | null | undefined): string {
  return normalizeCoachName(value);
}

export function scoreDuplicateCandidate(
  applicant: DuplicateApplicant,
  coach: DuplicateCoachSource
): DuplicateCoachCandidate | null {
  const nameMatch = compareNames(applicant.fullName, coach.name);
  if (!nameMatch) return null;

  const reasons: DuplicateMatchReason[] = [
    nameMatch === "same" ? "same_name" : "similar_name",
  ];
  let score = nameMatch === "same" ? 3 : 2;

  const applicantCities = new Set(
    applicant.locations.map((loc) => normalizedPlace(loc.city)).filter(Boolean)
  );
  const applicantCountries = new Set(
    applicant.locations.map((loc) => normalizedPlace(loc.country)).filter(Boolean)
  );
  const coachCities = coach.locations.map((loc) => normalizedPlace(loc.city)).filter(Boolean);
  const coachCountries = coach.locations
    .map((loc) => normalizedPlace(loc.country))
    .filter(Boolean);

  if (coachCities.some((city) => applicantCities.has(city))) {
    reasons.push("same_city");
    score += 1;
  } else if (coachCountries.some((country) => applicantCountries.has(country))) {
    reasons.push("same_country");
    score += 0.5;
  }

  const applicantRole = normalizedPlace(applicant.roleLabel);
  const coachRole = normalizedPlace(coach.role);
  if (applicantRole && coachRole && applicantRole === coachRole) {
    reasons.push("same_role");
    score += 0.5;
  }

  // A merely similar name needs a corroborating signal before we interrupt
  // the admin; an identical name is enough on its own.
  const corroborated =
    nameMatch === "same" ||
    reasons.some((reason) => reason !== "similar_name");
  if (!corroborated) return null;

  const primary =
    coach.locations.find((loc) => loc.isPrimary) ?? coach.locations[0] ?? null;
  const primaryLocation = primary
    ? [primary.city, primary.country].filter(Boolean).join(", ") || null
    : null;

  return {
    id: coach.id,
    name: coach.name?.trim() || "Unnamed coach",
    role: coach.role?.trim() || null,
    primaryLocation,
    publicationStatus: coach.publicationStatus,
    isClaimed: coach.isClaimed,
    managedByOtherAccount: coach.managedByOtherAccount,
    reasons,
    score,
  };
}

/** Rank and trim candidates to the few most useful for the admin. */
export function rankDuplicateCandidates(
  applicant: DuplicateApplicant,
  coaches: ReadonlyArray<DuplicateCoachSource>
): DuplicateCoachCandidate[] {
  return coaches
    .map((coach) => scoreDuplicateCandidate(applicant, coach))
    .filter((candidate): candidate is DuplicateCoachCandidate => candidate !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(a.managedByOtherAccount) - Number(b.managedByOtherAccount) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, MAX_DUPLICATE_CANDIDATES);
}
