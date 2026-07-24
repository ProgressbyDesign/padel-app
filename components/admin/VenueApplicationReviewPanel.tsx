"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveVenueApplicationWithExisting,
  approveVenueClaim,
  createAndApproveVenueApplication,
  declineVenueApplication,
  requestVenueApplicationChanges,
  searchVenuesForApprovalAction,
  startVenueApplicationReview,
} from "@/app/admin/(ops)/applications/venue-actions";
import type {
  AdminVenueApplication,
  AdminVenueSearchResult,
} from "@/lib/admin/applicationQueries";
import type { ApprovedMembershipRole } from "@/lib/venueProfileApplication/constants";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

export default function VenueApplicationReviewPanel({
  application,
  hasOwner,
}: {
  application: AdminVenueApplication;
  hasOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [note, setNote] = useState(application.review_note ?? "");
  const [membershipRole, setMembershipRole] = useState<ApprovedMembershipRole>(
    application.approved_membership_role ??
      (application.relationship_to_venue === "owner" ? "owner" : "manager")
  );
  const [search, setSearch] = useState(application.proposed_venue_name ?? "");
  const [results, setResults] = useState<AdminVenueSearchResult[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState(
    application.approved_venue_id ?? application.target_venue_id ?? ""
  );
  const [name, setName] = useState(application.proposed_venue_name ?? "");
  const [country, setCountry] = useState(application.proposed_country ?? "");
  const [city, setCity] = useState(application.proposed_city ?? "");
  const [address, setAddress] = useState(application.proposed_address ?? "");
  const [website, setWebsite] = useState(application.proposed_website ?? "");
  const [phone, setPhone] = useState(application.phone ?? "");
  const reviewable =
    application.status === "submitted" || application.status === "under_review";

  function run(
    action: () => Promise<{ ok: boolean; message: string; entityId?: string }>
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      setIsError(!result.ok);
      if (result.entityId && !result.ok) setSelectedVenueId(result.entityId);
      if (result.ok) router.refresh();
    });
  }

  function searchVenues() {
    setMessage(null);
    startTransition(async () => {
      const result = await searchVenuesForApprovalAction(search);
      if (!result.ok) {
        setIsError(true);
        setMessage(result.message);
        return;
      }
      setResults(result.venues);
      setIsError(false);
      if (result.venues.length === 0) setMessage("No matching venues found.");
    });
  }

  return (
    <aside className="space-y-5">
      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg">Review controls</h2>
        {application.status === "submitted" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => startVenueApplicationReview(application.id))}
            className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
          >
            Start review
          </button>
        ) : null}
        {reviewable ? (
          <div className="mt-5">
            <label className="text-sm font-semibold">
              Review note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                maxLength={2000}
                className={inputClass}
                placeholder="Required for changes or decline"
              />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={pending || !note.trim()}
                onClick={() =>
                  run(() => requestVenueApplicationChanges(application.id, note))
                }
                className="min-h-10 rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Request changes
              </button>
              <button
                type="button"
                disabled={pending || !note.trim()}
                onClick={() => run(() => declineVenueApplication(application.id, note))}
                className="min-h-10 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-40"
              >
                Decline
              </button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p
            className={`mt-4 rounded-xl p-3 text-sm ${
              isError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
            }`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </section>

      {reviewable ? (
        <>
          <section className="rounded-[24px] border border-primary/10 bg-white p-5">
            <h2 className="text-lg">Approval membership</h2>
            <label className="mt-4 block text-sm font-semibold">
              Role granted to applicant
              <select
                value={membershipRole}
                onChange={(event) =>
                  setMembershipRole(event.target.value as ApprovedMembershipRole)
                }
                className={inputClass}
              >
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
              </select>
            </label>
            {application.relationship_to_venue === "authorised_representative" ? (
              <p className="mt-2 text-xs leading-5 text-primary/50">
                Authorised representatives default to manager.
              </p>
            ) : null}
            {hasOwner && membershipRole === "owner" ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                This venue already has an owner membership. Confirm the role before approval.
              </p>
            ) : null}
          </section>

          {application.application_mode === "claim_existing" ? (
            <section className="rounded-[24px] border border-primary/10 bg-white p-5">
              <h2 className="text-lg">Approve venue claim</h2>
              <p className="mt-2 text-sm leading-6 text-primary/55">
                Approves the claimed target venue and lets the database trigger grant
                the selected membership.
              </p>
              <button
                type="button"
                disabled={pending || !application.target_venue_id}
                onClick={() =>
                  run(() =>
                    approveVenueClaim({
                      applicationId: application.id,
                      membershipRole,
                    })
                  )
                }
                className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-40"
              >
                Approve claim
              </button>
            </section>
          ) : null}

          <section className="rounded-[24px] border border-primary/10 bg-white p-5">
            <h2 className="text-lg">Approve using existing match</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-primary/15 px-3 py-2.5 text-sm"
                placeholder="Search venue name"
              />
              <button
                type="button"
                disabled={pending || search.trim().length < 2}
                onClick={searchVenues}
                className="rounded-xl border border-primary/15 px-4 text-sm font-semibold disabled:opacity-40"
              >
                Search
              </button>
            </div>
            {results.length ? (
              <div className="mt-3 space-y-2">
                {results.map((venue) => (
                  <label
                    key={venue.id}
                    className="flex cursor-pointer gap-3 rounded-xl border border-primary/10 p-3"
                  >
                    <input
                      type="radio"
                      name="venue"
                      checked={selectedVenueId === venue.id}
                      onChange={() => setSelectedVenueId(venue.id)}
                    />
                    <span>
                      <span className="block text-sm font-semibold">{venue.name}</span>
                      <span className="block text-xs text-primary/50">
                        {[venue.city, venue.country].filter(Boolean).join(", ") || "Location unavailable"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {selectedVenueId ? (
              <p className="mt-3 break-all text-xs text-primary/50">
                Selected: {selectedVenueId}
              </p>
            ) : null}
            <button
              type="button"
              disabled={pending || !selectedVenueId}
              onClick={() =>
                run(() =>
                  approveVenueApplicationWithExisting({
                    applicationId: application.id,
                    venueId: selectedVenueId,
                    membershipRole,
                  })
                )
              }
              className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-40"
            >
              Approve selected venue
            </button>
          </section>

          {application.application_mode === "create_new" ? (
            <section className="rounded-[24px] border border-primary/10 bg-white p-5">
              <h2 className="text-lg">Create and approve venue</h2>
              <div className="mt-4 space-y-3">
                <Field label="Name" value={name} setValue={setName} />
                <Field label="Country" value={country} setValue={setCountry} />
                <Field label="City" value={city} setValue={setCity} />
                <Field label="Address" value={address} setValue={setAddress} />
                <Field label="Website" value={website} setValue={setWebsite} />
                <Field label="Phone" value={phone} setValue={setPhone} />
              </div>
              <button
                type="button"
                disabled={pending || name.trim().length < 2 || !country.trim() || !city.trim()}
                onClick={() =>
                  run(() =>
                    createAndApproveVenueApplication({
                      applicationId: application.id,
                      name,
                      country,
                      city,
                      address,
                      website,
                      phone,
                      membershipRole,
                    })
                  )
                }
                className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-40"
              >
                Create venue and approve
              </button>
            </section>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}

function Field({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}
