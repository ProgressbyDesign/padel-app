import { NextResponse } from "next/server";
import { fetchTopRatedCoachesForHome } from "../../../../lib/queries/topRatedHome";

export async function GET() {
  try {
    const coaches = await fetchTopRatedCoachesForHome();
    return NextResponse.json({ coaches });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
