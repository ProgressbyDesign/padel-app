import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Heart, MapPin } from "lucide-react";
import HomeHeroVideo from "@/components/home/HomeHeroVideo";
import { HERO_VIDEO_SRC, HERO_POSTER_SRC } from "@/lib/home/heroMedia";

export default function AuthExperience({ title, description, children, joining = false, audience = "player", wideForm = false }: {
  title: string; description: string; children: React.ReactNode; joining?: boolean; audience?: "player" | "coach" | "venue"; wideForm?: boolean;
}) {
  return <div className={`min-h-dvh bg-white lg:grid ${joining ? "lg:grid-cols-[1fr_1.15fr]" : "lg:grid-cols-[1.15fr_0.85fr]"}`}>
    <section className="flex min-h-dvh flex-col px-6 py-7 sm:px-12">
      <Link href="/" aria-label="Padel Pathways home"><Image src="/brand/padelpathways-logo-color.svg" alt="Padel Pathways" width={170} height={50} priority /></Link>
      <div className={`mx-auto flex w-full flex-1 flex-col justify-center py-10 ${wideForm ? "max-w-2xl" : "max-w-md"}`}>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <p className="mb-8 mt-4 text-sm leading-6 text-primary/65">{description}</p>
        {children}
      </div>
      <Link href="/contact" className="text-xs text-primary/60">Need a hand? Contact us</Link>
    </section>
    <aside className="sticky top-0 hidden h-dvh overflow-hidden bg-primary lg:block">
      <Image src={HERO_POSTER_SRC} alt="" fill priority sizes="55vw" className="object-cover" />
      {HERO_VIDEO_SRC ? <HomeHeroVideo src={HERO_VIDEO_SRC} poster={HERO_POSTER_SRC} /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-16">
        <h2 className="max-w-lg text-4xl leading-tight text-white xl:text-5xl">{audience === "coach" ? "Make your coaching count." : audience === "venue" ? "Bring your venue to life." : joining ? "Your padel journey, in one place." : "Make time for your game."}</h2>
        <p className="mt-5 max-w-md text-base leading-7 text-white/80">{audience === "player" ? "Great coaching. Places you love. More time on court." : "A place for your profile, your partnerships and your next sessions."}</p>
        {joining ? <div className="mt-8 grid gap-3">
          {(audience !== "player" ? [{Icon:MapPin,title:"Show what makes you different",body:audience === "coach" ? "Share your coaching style and where you train." : "Introduce your courts, facilities and coaching."},{Icon:CalendarDays,title:"Keep sessions organised",body:"Manage availability and coaching bookings together."},{Icon:Heart,title:"Build your profile at your pace",body:"Save your application and return when you are ready."}] : [{Icon:MapPin,title:"Find your place to play",body:"Discover clubs and coaching near you."},{Icon:CalendarDays,title:"Keep your bookings together",body:"Manage sessions and share your progress."},{Icon:Heart,title:"Keep your favourites close",body:"Save your go-to coach and club."}]).map(({Icon,title,body}) => <div key={title} className="flex gap-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md"><Icon className="h-6 w-6 shrink-0 text-accent" /><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-white/75">{body}</p></div></div>)}
        </div> : null}
      </div>
    </aside>
  </div>;
}
