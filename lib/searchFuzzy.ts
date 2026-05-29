/**
 * Lightweight client-side fuzzy matching (no external search engine).
 * Normalizes spacing, hyphens, and casing for padel venue/coach names.
 */

export function normalizeSearchKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s\-_./'’,]+/g, "");
}

function subsequenceScore(query: string, target: string): number {
  if (!query || !target) return 0;
  let qi = 0;
  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i] === query[qi]) qi++;
  }
  if (qi !== query.length) return 0;
  return 35 + Math.min(15, Math.floor((query.length / target.length) * 15));
}

/** 0 = no match; higher = better */
export function searchMatchScore(query: string, primary: string, secondary = ""): number {
  const q = normalizeSearchKey(query.trim());
  if (!q) return 1;

  const p = normalizeSearchKey(primary);
  const s = normalizeSearchKey(secondary);
  const combined = p + s;
  if (!combined) return 0;

  if (combined === q) return 100;
  if (p === q || s === q) return 98;
  if (combined.startsWith(q)) return 88;
  if (p.startsWith(q) || s.startsWith(q)) return 86;
  if (combined.includes(q)) return 72;
  if (p.includes(q)) return 70;
  if (s.includes(q)) return 65;

  const sub = Math.max(subsequenceScore(q, combined), subsequenceScore(q, p), subsequenceScore(q, s));
  if (sub > 0) return sub;

  const qWords = query
    .toLowerCase()
    .split(/[\s\-]+/)
    .map((w) => normalizeSearchKey(w))
    .filter(Boolean);
  if (qWords.length > 1) {
    const allFound = qWords.every((w) => combined.includes(w) || p.includes(w));
    if (allFound) return 50;
  }

  return 0;
}

export function rankSearchMatches<T>(
  items: T[],
  query: string,
  getFields: (item: T) => { primary: string; secondary?: string },
  limit: number
): T[] {
  const q = query.trim();
  if (!q) return items.slice(0, limit);

  return [...items]
    .map((item) => {
      const { primary, secondary = "" } = getFields(item);
      return { item, score: searchMatchScore(q, primary, secondary) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item)
    .slice(0, limit);
}

export function fuzzyFilterLabels<T extends { label: string }>(items: T[], query: string, limit: number): T[] {
  return rankSearchMatches(items, query, (o) => ({ primary: o.label }), limit);
}
