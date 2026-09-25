import Image from "next/image";
export default function ResultsHeader({ kind }: { kind: "coaches" | "venues" }) {
 return <header><h1 className="text-2xl sm:text-3xl">{kind === "coaches" ? "Find a padel coach" : "Find your next padel venue"}</h1><div className="relative mt-5 h-28 w-full overflow-hidden rounded-2xl sm:h-36"><Image src={kind === "coaches" ? "/images/discovery/coaching-session.webp" : "/images/discovery/coastal-venue.webp"} alt="" fill priority sizes="(max-width: 1680px) 100vw, 1680px" className="object-cover object-center" /><div className="absolute inset-0 bg-primary/20" /></div></header>;
}
