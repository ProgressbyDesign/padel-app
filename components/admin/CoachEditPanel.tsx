"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteCoachOutcomeAdmin,
  deleteCoachSocialAdmin,
  linkCoachVenuesAdmin,
  unlinkCoachVenueAdmin,
  updateCoachAdmin,
  upsertCoachOutcomeAdmin,
  upsertCoachSocialAdmin,
} from "@/app/actions/admin";
import { searchVenuesAdminAction } from "@/app/actions/admin";
import {
  DATA_QUALITY_OPTIONS,
  type AdminCoachDetail,
  type CoachImageRow,
  type CoachOutcomeRow,
  type CoachSocialRow,
  type CoachVenueLinkRow,
} from "@/lib/admin/types";
import CoachImagesPanel from "./CoachImagesPanel";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from "./ui";

export default function CoachEditPanel({
  coach,
  links,
  outcomes,
  socials,
  images,
}: {
  coach: AdminCoachDetail;
  links: CoachVenueLinkRow[];
  outcomes: CoachOutcomeRow[];
  socials: CoachSocialRow[];
  images: CoachImageRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: coach.name ?? "",
    role: coach.role ?? "",
    description: coach.description ?? "",
    level: coach.level ?? "",
    experience_years: coach.experience_years != null ? String(coach.experience_years) : "",
    price_from: coach.price_from ?? "",
    email: coach.email ?? "",
    phone: coach.phone ?? "",
    image_url: coach.image_url ?? "",
    is_approved: Boolean(coach.is_approved),
    data_quality_status: coach.data_quality_status ?? "pending",
  });

  const [venueSearch, setVenueSearch] = useState("");
  const [venueHits, setVenueHits] = useState<
    { id: string; name: string; city: string | null; country: string | null; website: string | null }[]
  >([]);
  const [selectedVenue, setSelectedVenue] = useState("");

  const [outcomeDraft, setOutcomeDraft] = useState({ id: "", outcome: "" });
  const [socialDraft, setSocialDraft] = useState({ id: "", platform: "", url: "", is_primary: false });

  function saveCoach(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await updateCoachAdmin(coach.id, form);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setMessage("Coach saved.");
      router.refresh();
    });
  }

  async function runVenueSearch() {
    const res = await searchVenuesAdminAction(venueSearch);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setVenueHits(res.venues);
  }

  function linkVenue() {
    if (!selectedVenue) return;
    startTransition(async () => {
      const res = await linkCoachVenuesAdmin(coach.id, [selectedVenue], selectedVenue);
      if (!res.ok) setError(res.message);
      else {
        setSelectedVenue("");
        router.refresh();
      }
    });
  }

  function unlink(venueId: string) {
    startTransition(async () => {
      const res = await unlinkCoachVenueAdmin(coach.id, venueId);
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <AdminCard>
        <form onSubmit={saveCoach} className="space-y-4">
          <h2 className="font-semibold text-primary">Edit coach</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              Name
              <AdminInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Role
              <AdminInput value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Level
              <AdminInput value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm sm:col-span-2">
              Description
              <AdminTextarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1"
              />
            </label>
            <label className="text-sm">
              Experience (years)
              <AdminInput
                value={form.experience_years}
                onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                className="mt-1"
              />
            </label>
            <label className="text-sm">
              Price from
              <AdminInput value={form.price_from} onChange={(e) => setForm({ ...form, price_from: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Email
              <AdminInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Phone
              <AdminInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm sm:col-span-2">
              Legacy image URL (fallback)
              <AdminInput value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="mt-1" />
              <span className="mt-1 block text-xs text-primary/50">
                Used only when no primary image exists in coach_images. Prefer the Images section below.
              </span>
            </label>
            <label className="text-sm">
              Data quality
              <AdminSelect
                value={form.data_quality_status}
                onChange={(e) => setForm({ ...form, data_quality_status: e.target.value })}
                className="mt-1"
              >
                {DATA_QUALITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_approved}
                onChange={(e) => setForm({ ...form, is_approved: e.target.checked })}
              />
              Approved
            </label>
          </div>
          <AdminButton type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save coach"}
          </AdminButton>
        </form>
      </AdminCard>

      <CoachImagesPanel coachId={coach.id} fallbackImageUrl={coach.image_url} images={images} />

      <AdminCard>
        <h2 className="mb-3 font-semibold text-primary">Linked venues</h2>
        {links.length === 0 ? (
          <p className="text-sm text-primary/50">No venues linked. Location on the public site comes from coach_venues.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {links.map((l) => {
              const v = l.venues;
              const label = v
                ? `${v.name ?? "Venue"}${v.city || v.country ? ` · ${[v.city, v.country].filter(Boolean).join(", ")}` : ""}`
                : l.venue_id;
              return (
                <li key={l.venue_id} className="flex items-center gap-2 text-sm">
                  {l.is_primary ? <AdminBadge tone="ok">Primary</AdminBadge> : null}
                  <span>{label}</span>
                  <button type="button" className="text-xs text-red-600 underline" onClick={() => unlink(l.venue_id)}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <AdminInput
            placeholder="Search venues by name, city…"
            value={venueSearch}
            onChange={(e) => setVenueSearch(e.target.value)}
            className="max-w-xs flex-1"
          />
          <AdminButton type="button" variant="secondary" onClick={runVenueSearch}>
            Search
          </AdminButton>
        </div>
        {venueHits.length > 0 ? (
          <AdminSelect
            className="mt-2 max-w-md"
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
          >
            <option value="">Select venue…</option>
            {venueHits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.city || v.country ? ` (${[v.city, v.country].filter(Boolean).join(", ")})` : ""}
              </option>
            ))}
          </AdminSelect>
        ) : null}
        <AdminButton type="button" className="mt-2" variant="secondary" disabled={!selectedVenue || pending} onClick={linkVenue}>
          Link venue (as primary)
        </AdminButton>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-3 font-semibold text-primary">Outcomes</h2>
        <ul className="mb-3 space-y-1">
          {outcomes.map((o) => (
            <li key={o.id} className="flex gap-2 text-sm">
              <span className="flex-1">{o.outcome}</span>
              <button type="button" className="text-xs underline" onClick={() => setOutcomeDraft({ id: o.id, outcome: o.outcome })}>
                Edit
              </button>
              <button
                type="button"
                className="text-xs text-red-600 underline"
                onClick={() => {
                  startTransition(async () => {
                    await deleteCoachOutcomeAdmin(o.id, coach.id);
                    router.refresh();
                  });
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await upsertCoachOutcomeAdmin({
                id: outcomeDraft.id || undefined,
                coach_id: coach.id,
                outcome: outcomeDraft.outcome,
              });
              setOutcomeDraft({ id: "", outcome: "" });
              router.refresh();
            });
          }}
        >
          <AdminInput
            className="flex-1"
            placeholder="Outcome text"
            value={outcomeDraft.outcome}
            onChange={(e) => setOutcomeDraft({ ...outcomeDraft, outcome: e.target.value })}
          />
          <AdminButton type="submit" variant="secondary">
            {outcomeDraft.id ? "Update" : "Add"}
          </AdminButton>
        </form>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-3 font-semibold text-primary">Socials</h2>
        <ul className="mb-3 space-y-1">
          {socials.map((s) => (
            <li key={s.id} className="flex flex-wrap gap-2 text-sm">
              <AdminBadge>{s.platform}</AdminBadge>
              <a href={s.url} className="text-secondary underline" target="_blank" rel="noreferrer">
                {s.url}
              </a>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => setSocialDraft({ id: s.id, platform: s.platform, url: s.url, is_primary: Boolean(s.is_primary) })}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-xs text-red-600 underline"
                onClick={() => {
                  startTransition(async () => {
                    await deleteCoachSocialAdmin(s.id, coach.id);
                    router.refresh();
                  });
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await upsertCoachSocialAdmin({
                coach_id: coach.id,
                platform: socialDraft.platform,
                url: socialDraft.url,
                is_primary: socialDraft.is_primary,
                id: socialDraft.id || undefined,
              });
              setSocialDraft({ id: "", platform: "", url: "", is_primary: false });
              router.refresh();
            });
          }}
        >
          <AdminInput placeholder="Platform" value={socialDraft.platform} onChange={(e) => setSocialDraft({ ...socialDraft, platform: e.target.value })} />
          <AdminInput placeholder="URL" value={socialDraft.url} onChange={(e) => setSocialDraft({ ...socialDraft, url: e.target.value })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={socialDraft.is_primary}
              onChange={(e) => setSocialDraft({ ...socialDraft, is_primary: e.target.checked })}
            />
            Primary
          </label>
          <AdminButton type="submit" variant="secondary">
            {socialDraft.id ? "Update social" : "Add social"}
          </AdminButton>
        </form>
      </AdminCard>
    </div>
  );
}
