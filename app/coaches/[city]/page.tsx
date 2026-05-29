import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { displayCityFromSlug } from "../../../lib/coachListing";

type PageProps = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params;
  const slug = decodeURIComponent(city).toLowerCase();
  const label = displayCityFromSlug(slug);
  return {
    title: `Padel coaches in ${label}`,
    description: `Find padel coaches in ${label}. Filter by level, audience, travel, and more.`,
  };
}

/** SEO city URLs → main listing with location search in query string. */
export default async function CoachesCityPage({ params }: PageProps) {
  const { city } = await params;
  const slug = decodeURIComponent(city).toLowerCase().trim();
  const label = displayCityFromSlug(slug);
  if (!label) redirect("/coaches");
  const q = new URLSearchParams({ search: label });
  redirect(`/coaches?${q.toString()}`);
}
