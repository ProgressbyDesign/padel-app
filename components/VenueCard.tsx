export default function VenueCard({ venue }) {
  return (
    <div className="border rounded-xl p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{venue.name}</h2>

      <p>{venue.city}, {venue.country}</p>
  <p className="mt-2 text-sm">{venue.coaching_description}</p>
      <div className="mt-2 text-sm">
        🎾 {venue.courts || "?"} courts • {venue.court_type}
      </div>

      <div className="text-sm">
        🏋️ {venue.coaching_available ? "Coaching" : "No coaching"}
      </div>

      <div className="text-sm">
        ⭐ {venue.rating}
      </div>
    </div>
  );
}