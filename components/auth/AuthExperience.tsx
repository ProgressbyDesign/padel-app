import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Heart, MapPin } from "lucide-react";
import HomeHeroVideo from "@/components/home/HomeHeroVideo";
import { HERO_VIDEO_SRC, HERO_POSTER_SRC } from "@/lib/home/heroMedia";

export default function AuthExperience({ title, description, children, joining = false, audience = "player", wideForm = false }: {
  title: string; description: string; children: React.ReactNode; joining?: boolean; audience?: "player" | "coach" | "venue"; wideForm?: boolean;
}) {
  const selectedVideo = !joining ? "/videos/login-video.mp4" : audience === "coach" ? "/videos/coach-register-video.mp4" : HERO_VIDEO_SRC;
  const videoSrc = selectedVideo && existsSync(path.join(process.cwd(), "public", selectedVideo)) ? selectedVideo : null;
  return <div className={`min-h-dvh bg-white lg:grid ${wideForm ? "lg:grid-cols-[minmax(0,1fr)_30%]" : joining ? "lg:grid-cols-[1fr_1.15fr]" : "lg:grid-cols-[1.15fr_0.85fr]"}`}>
    <section className={`flex min-h-dvh flex-col px-6 sm:px-10 ${wideForm ? "py-4" : "py-7"}`}>
      <Link href="/" aria-label="Padel Pathways home"><Image src="/brand/padelpathways-logo-color.svg" alt="Padel Pathways" width={wideForm ? 140 : 170} height={wideForm ? 41 : 50} priority /></Link>
      <div className={`mx-auto flex w-full flex-1 flex-col ${wideForm ? "max-w-5xl justify-start py-4" : "max-w-md justify-center py-10"}`}>
        <h1 className={wideForm ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}>{title}</h1>
        <p className={`text-sm leading-6 text-primary/65 ${wideForm ? "mb-3 mt-2" : "mb-8 mt-4"}`}>{description}</p>
        {children}
      </div>
      <Link href="/contact" className="text-xs text-primary/60">Need a hand? Contact us</Link>
    </section>
    <aside className="sticky top-0 hidden h-dvh overflow-hidden bg-primary lg:block">
      <Image src={HERO_POSTER_SRC} alt="" fill priority sizes="55vw" className="object-cover" />
      {videoSrc ? <HomeHeroVideo src={videoSrc} poster={HERO_POSTER_SRC} /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/20 to-transparent" />
      <div className={`absolute inset-x-0 bottom-0 text-white ${wideForm ? "p-7" : "p-10 xl:p-16"}`}>
        <h2 className={`max-w-lg leading-tight text-white ${wideForm ? "text-3xl" : "text-4xl xl:text-5xl"}`}>{audience === "coach" ? "Make your coaching count." : audience === "venue" ? "Bring your venue to life." : joining ? "Your padel journey, in one place." : "Make time for your game."}</h2>
        <p className="mt-5 max-w-md text-base leading-7 text-white/80">{audience === "player" ? "Great coaching. Places you love. More time on court." : "A place for your profile, your partnerships and your next sessions."}</p>
        {joining && !wideForm ? <div className="mt-8 grid gap-3">
          {(audience !== "player" ? [{Icon:MapPin,title:"Show what makes you different",body:audience === "coach" ? "Share your coaching style and where you train." : "Introduce your courts, facilities and coaching."},{Icon:CalendarDays,title:"Keep sessions organised",body:"Manage availability and coaching bookings together."},{Icon:Heart,title:"Build your profile at your pace",body:"Save your application and return when you are ready."}] : [{Icon:MapPin,title:"Find your place to play",body:"Discover clubs and coaching near you."},{Icon:CalendarDays,title:"Keep your bookings together",body:"Manage sessions and share your progress."},{Icon:Heart,title:"Keep your favourites close",body:"Save your go-to coach and club."}]).map(({Icon,title,body}) => <div key={title} className="flex gap-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md"><Icon className="h-6 w-6 shrink-0 text-accent" /><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-white/75">{body}</p></div></div>)}
        </div> : null}
      </div>
    </aside>
  </div>;
}
