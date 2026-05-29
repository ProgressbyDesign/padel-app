import { NextResponse } from "next/server";
import type { SearchMode } from "../../../../lib/marketplaceSearch";
import { fetchSearchSuggestions } from "../../../../lib/queries/searchSuggestions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const modeRaw = searchParams.get("mode");
  const fieldRaw = searchParams.get("field");
  const q = searchParams.get("q") ?? "";
  const location = searchParams.get("location") ?? "";

  const mode: SearchMode = modeRaw === "coaches" ? "coaches" : "venues";
  const field = fieldRaw === "entity" ? "entity" : "where";

  try {
    const payload = await fetchSearchSuggestions(mode, field, q, location);
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Suggestions failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
