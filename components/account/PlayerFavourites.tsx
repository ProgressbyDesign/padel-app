"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Heart } from "lucide-react";
import { savePlayerFavourites } from "@/app/account/personal/favourite-actions";
type Choice = {id:string;name:string|null};
export default function PlayerFavourites({coaches,venues,coachId,venueId,available}: {coaches:Choice[];venues:Choice[];coachId:string|null;venueId:string|null;available:boolean}) {
  const [state, action, pending] = useActionState(savePlayerFavourites,{message:""});
  return <section id="favourites" className="rounded-3xl border border-primary/10 bg-white p-6">
    <h2 className="flex items-center gap-3 text-2xl"><Heart className="h-6 w-6" />Your favourites</h2>
    {!available ? <p className="mt-4 text-sm">Favourites are temporarily unavailable.</p> : <form action={action} className="mt-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {[{name:"coach",title:"Favourite coach",choices:coaches,id:coachId,path:"coach"},{name:"venue",title:"Favourite club",choices:venues,id:venueId,path:"venue"}].map(item=><div key={item.name}><label className="block text-sm font-semibold">{item.title}<select name={item.name} defaultValue={item.id ?? ""} className="mt-2 min-h-12 w-full rounded-xl border border-primary/20 bg-surface px-3"><option value="">Choose your favourite</option>{item.choices.map(choice=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>{item.id && item.choices.some(c=>c.id===item.id) ? <Link href={`/${item.path}/${item.id}`} className="mt-2 inline-block text-sm underline">View profile</Link> : null}</div>)}
      </div>
      <button disabled={pending} className="mt-5 min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-accent disabled:opacity-50">{pending ? "Saving…" : "Save favourites"}</button>
      {state.message ? <p role="status" className="mt-3 text-sm">{state.message}</p> : null}
    </form>}
  </section>;
}
