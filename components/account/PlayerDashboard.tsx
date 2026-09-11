import CoachVerificationCard from "@/components/account/CoachVerificationCard";
import type { AccountCoachApplicationSummary, AccountVenueApplicationSummary } from "@/lib/queries/accountDashboard";
import Link from "next/link";
import Image from "next/image";
import { HERO_POSTER_SRC } from "@/lib/home/heroMedia";
import { CalendarDays, Heart, LayoutDashboard, Settings, Compass } from "lucide-react";
import AccountAvatar from "@/components/account/AccountAvatar";
import PlayerBookingCard from "@/components/bookings/PlayerBookingCard";
import PlayerFavourites from "@/components/account/PlayerFavourites";
import { loadPlayerBookings, partitionPlayerBookings } from "@/lib/queries/coachBookings";
import { loadOptionalAccountNavContext } from "@/lib/workspace/resolve";
import { createClient } from "@/lib/supabase/server";

export default async function PlayerDashboard({account, coachApplication, venueApplication}: {account:{id:string;fullName:string|null;email:string}; coachApplication: AccountCoachApplicationSummary; venueApplication: AccountVenueApplicationSummary}) {
  const supabase = await createClient();
  const [bookings,nav,favourites,coaches,venues] = await Promise.all([
    loadPlayerBookings(account.id), loadOptionalAccountNavContext(),
    supabase.from("player_favourites").select("coach_id,venue_id").eq("user_id",account.id).maybeSingle(),
    supabase.from("coach_public_profiles").select("id,name").order("name"),
    supabase.from("venue_public_profiles").select("id,name").order("name"),
  ]);
  const { data: auth } = await supabase.auth.getClaims();
  const intent = auth?.claims?.user_metadata?.signup_intent;
  const showCoachVerification = Boolean(coachApplication) || (intent !== "player" && intent !== "venue" && !venueApplication);
  const showVenueVerification = Boolean(venueApplication) || intent === "venue";
  const recent = [...bookings].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,3);
  const upcoming = partitionPlayerBookings(bookings).upcoming.filter(b=>b.status==="accepted");
  const completed = bookings.filter(b=>b.status==="completed").length;
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside><nav aria-label="Player dashboard" className="flex gap-2 overflow-x-auto lg:sticky lg:top-24 lg:flex-col">
        {[{Icon:LayoutDashboard,label:"Dashboard",href:"/account/personal"},{Icon:CalendarDays,label:"Bookings",href:"/account/bookings"},{Icon:Heart,label:"Favourites",href:"#favourites"},{Icon:Compass,label:"Find a coach",href:"/coaches"},{Icon:Settings,label:"Account settings",href:"/account/settings"}].map((item,i)=><Link key={item.label} href={item.href} className={`flex min-h-12 shrink-0 items-center gap-3 rounded-xl px-4 text-sm font-semibold ${i===0?"bg-primary text-accent":"bg-white text-primary/75"}`}><item.Icon className="h-4 w-4" />{item.label}</Link>)}
      </nav></aside>
      <div className="min-w-0 space-y-7">
        <section className="relative overflow-hidden rounded-3xl bg-primary p-7 text-white sm:p-9">
          <Image src={HERO_POSTER_SRC} alt="" fill sizes="900px" className="object-cover opacity-25" />
          <div className="relative flex flex-wrap items-center gap-5"><AccountAvatar url={nav?.avatarUrl} name={account.fullName} email={account.email} size="lg" /><div><h1 className="text-3xl text-white sm:text-4xl">Welcome{account.fullName ? `, ${account.fullName}` : " back"}</h1><p className="mt-3 text-sm text-white/80">Your next session starts here.</p><Link href="/account/settings" className="mt-3 inline-block text-xs underline text-white/80">Account details</Link></div></div>
          <dl className="relative mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-5">{[{label:"Upcoming",value:upcoming.length},{label:"Completed",value:completed},{label:"Bookings",value:bookings.length}].map(item=><div key={item.label}><dd className="text-3xl font-semibold text-accent">{item.value}</dd><dt className="mt-1 text-xs text-white/80">{item.label}</dt></div>)}</dl>
        </section>
        {showCoachVerification ? <CoachVerificationCard application={coachApplication} /> : null}
        {showVenueVerification ? <section id="venue-verification" className="rounded-3xl border border-primary/15 bg-white p-6">
          <h2 className="text-2xl">Verify your venue account</h2>
          <p className="mt-3 text-sm text-primary/70">{venueApplication ? `Venue application: ${venueApplication.status.replaceAll("_", " ")} · Step ${venueApplication.currentStep}` : "Add your venue details and submit them for review."}</p>
          <Link href="/account/applications/venue" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-accent">{venueApplication ? "Continue venue application" : "Start venue application"}</Link>
        </section> : null}
        <section><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-2xl">Recent bookings</h2><Link href="/account/bookings" className="text-sm font-semibold underline">View all</Link></div>
          {recent.length ? <ul className="space-y-3">{recent.map(booking=><PlayerBookingCard key={booking.id} booking={booking} />)}</ul> : <div className="rounded-3xl border border-primary/10 bg-white p-7"><h3 className="text-xl">Make your first session happen</h3><p className="mt-3 text-sm text-primary/65">Find coaching that fits your game and your schedule.</p><Link href="/coaches" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-accent">Find a coach</Link></div>}
        </section>
        <PlayerFavourites coaches={coaches.data ?? []} venues={venues.data ?? []} coachId={favourites.data?.coach_id ?? null} venueId={favourites.data?.venue_id ?? null} available={!favourites.error && !coaches.error && !venues.error} />
      </div>
    </div>
  </div>;
}
