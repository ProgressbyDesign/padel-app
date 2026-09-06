"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createCoachLocation,
  deleteCoachLocation,
  setPrimaryCoachLocation,
  updateCoachLocation,
} from "@/app/account/coaches/[coachId]/location-actions";
import {
  ActionButton,
  ConfirmActionButton,
} from "@/components/account/RelationshipActionControls";
import {
  CITY_SUGGESTIONS_BY_COUNTRY,
  type ApplicationCountry,
} from "@/lib/coachProfileApplication/constants";
import {
  MAX_COACH_LOCATIONS,
  type CoachLocationRow,
} from "@/lib/coachLocations";
import { SUPPORTED_COUNTRIES } from "@/lib/venueEditorOptions";

export default function CoachLocationsManager({
  coachId,
  locations,
}: {
  coachId: string;
  locations: CoachLocationRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState<string>(
    SUPPORTED_COUNTRIES[0]?.value ?? "Spain"
  );
  const [city, setCity] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCountry, setEditCountry] = useState("");
  const [editCity, setEditCity] = useState("");

  const atLimit = locations.length >= MAX_COACH_LOCATIONS;
  const citySuggestions =
    CITY_SUGGESTIONS_BY_COUNTRY[country as ApplicationCountry] ?? [];

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage(result.message);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-primary">Locations</h2>
        <p className="mt-2 text-sm text-primary/65">
          Add up to {MAX_COACH_LOCATIONS} cities where you coach. One location is
          primary and shown first on your public profile.
        </p>
      </div>

      {locations.length === 0 ? (
        <p className="text-sm text-primary/55">No locations yet.</p>
      ) : (
        <ul className="space-y-3">
          {locations.map((location) => (
            <li
              key={location.id}
              className="rounded-2xl border border-primary/10 bg-white p-4"
            >
              {editingId === location.id ? (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-primary">
                    Country
                    <select
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm"
                    >
                      {SUPPORTED_COUNTRIES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-primary">
                    City
                    <input
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      pending={pending}
                      onClick={() =>
                        run(async () => {
                          const result = await updateCoachLocation(
                            coachId,
                            location.id,
                            { country: editCountry, city: editCity }
                          );
                          if (result.ok) setEditingId(null);
                          return result;
                        })
                      }
                    >
                      Save
                    </ActionButton>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/70"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary">
                      {location.city}, {location.country}
                    </p>
                    {location.is_primary ? (
                      <p className="mt-1 text-xs font-semibold text-emerald-800">
                        Primary
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!location.is_primary ? (
                      <ActionButton
                        pending={pending}
                        tone="secondary"
                        onClick={() =>
                          run(() =>
                            setPrimaryCoachLocation(coachId, location.id)
                          )
                        }
                      >
                        Set primary
                      </ActionButton>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(location.id);
                        setEditCountry(location.country);
                        setEditCity(location.city);
                      }}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/70"
                    >
                      Edit
                    </button>
                    <ConfirmActionButton
                      label="Remove"
                      confirmLabel="Confirm remove"
                      onConfirm={async () => {
                        const result = await deleteCoachLocation(
                          coachId,
                          location.id
                        );
                        if (result.ok) {
                          setMessage(result.message);
                          router.refresh();
                        } else {
                          setError(result.message);
                        }
                        return result;
                      }}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-2xl border border-primary/10 bg-white p-4 sm:p-5">
        <h3 className="text-lg text-primary">Add location</h3>
        {atLimit ? (
          <p className="mt-2 text-sm text-primary/55">
            You have reached the maximum of {MAX_COACH_LOCATIONS} locations.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-primary">
              Country
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm"
              >
                {SUPPORTED_COUNTRIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-primary">
              City
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                list={`city-suggestions-${coachId}`}
                placeholder="City or town"
                className="mt-1.5 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm"
              />
              <datalist id={`city-suggestions-${coachId}`}>
                {citySuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </label>
            <ActionButton
              pending={pending}
              onClick={() =>
                run(async () => {
                  const result = await createCoachLocation(coachId, {
                    country,
                    city,
                    isPrimary: locations.length === 0,
                  });
                  if (result.ok) setCity("");
                  return result;
                })
              }
            >
              Add location
            </ActionButton>
          </div>
        )}
      </section>

      {message ? (
        <p className="text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
