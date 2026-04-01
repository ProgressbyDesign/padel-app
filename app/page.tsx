import { supabase } from "../lib/supabase";
import VenuesClient from "../components/VenuesClient";

export default async function Home() {
  const { data } = await supabase
    .from("venues")
    .select("*")
    .limit(100);

  return <VenuesClient venues={data ?? []} />;
}