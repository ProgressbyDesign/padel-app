import { supabase } from "../lib/supabase";
import VenueCard from "../components/VenueCard";

export default async function Home() {
  const { data } = await supabase
    .from("venues")
    .select("*")
    .limit(20);

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
      </div>
    </div>
  );
}