import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const [venueRes, coachRes] = await Promise.all([
      supabase.from("venues").select("*", { count: "exact", head: true }),
      supabase.from("coaches").select("*", { count: "exact", head: true }),
    ]);

    const venueCount =
      !venueRes.error && typeof venueRes.count === "number" ? venueRes.count : null;
    const coachCount =
      !coachRes.error && typeof coachRes.count === "number" ? coachRes.count : null;

    return NextResponse.json(
      { venueCount, coachCount },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Counts failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
