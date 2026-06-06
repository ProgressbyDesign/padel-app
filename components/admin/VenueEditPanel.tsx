"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteVenueSocialAdmin,
  updateVenueAdmin,
  upsertVenueSocialAdmin,
} from "@/app/actions/admin";
import { DATA_QUALITY_OPTIONS, type AdminVenueDetail, type VenueSocialRow } from "@/lib/admin/types";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from "./ui";

export default function VenueEditPanel({
  venue,
  socials,
}: {
  venue: AdminVenueDetail;
  socials: VenueSocialRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: venue.name ?? "",
    description: venue.description ?? "",
    courts: venue.courts != null ? String(venue.courts) : "",
    court_type: venue.court_type ?? "",
    venue_type: venue.venue_type ?? "",
    coaching_available: Boolean(venue.coaching_available),
    coaching_description: venue.coaching_description ?? "",
    price: venue.price ?? "",
    is_approved: Boolean(venue.is_approved),
    data_quality_status: venue.data_quality_status ?? "pending",
  });

  const [socialDraft, setSocialDraft] = useState({
    id: "",
    platform: "",
    url: "",
    is_primary: false,
  });

  function saveVenue(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await updateVenueAdmin(venue.id, form);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setMessage("Venue saved.");
      router.refresh();
    });
  }

  function saveSocial(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await upsertVenueSocialAdmin({
        id: socialDraft.id || undefined,
        venue_id: venue.id,
        platform: socialDraft.platform,
        url: socialDraft.url,
        is_primary: socialDraft.is_primary,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSocialDraft({ id: "", platform: "", url: "", is_primary: false });
      setMessage("Social link saved.");
      router.refresh();
    });
  }

  function editSocial(row: VenueSocialRow) {
    setSocialDraft({
      id: row.id,
      platform: row.platform,
      url: row.url,
      is_primary: Boolean(row.is_primary),
    });
  }

  function removeSocial(id: string) {
    if (!confirm("Delete this social link?")) return;
    startTransition(async () => {
      const res = await deleteVenueSocialAdmin(id, venue.id);
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <AdminCard>
        <form onSubmit={saveVenue} className="space-y-4">
          <h2 className="font-semibold text-primary">Edit venue</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              Name
              <AdminInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
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
              Courts
              <AdminInput value={form.courts} onChange={(e) => setForm({ ...form, courts: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Court type
              <AdminInput value={form.court_type} onChange={(e) => setForm({ ...form, court_type: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Venue type
              <AdminInput value={form.venue_type} onChange={(e) => setForm({ ...form, venue_type: e.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">
              Price
              <AdminInput value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1" />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.coaching_available}
                onChange={(e) => setForm({ ...form, coaching_available: e.target.checked })}
              />
              Coaching available
            </label>
            <label className="text-sm sm:col-span-2">
              Coaching description
              <AdminTextarea
                rows={2}
                value={form.coaching_description}
                onChange={(e) => setForm({ ...form, coaching_description: e.target.value })}
                className="mt-1"
              />
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
              Approved for public site
            </label>
          </div>
          <AdminButton type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save venue"}
          </AdminButton>
        </form>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-3 font-semibold text-primary">Venue socials</h2>
        {socials.length === 0 ? (
          <p className="text-sm text-primary/50">No social links yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {socials.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <AdminBadge tone={s.is_primary ? "ok" : "neutral"}>{s.platform}</AdminBadge>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-secondary underline">
                  {s.url}
                </a>
                <button type="button" className="text-xs text-primary/60 underline" onClick={() => editSocial(s)}>
                  Edit
                </button>
                <button type="button" className="text-xs text-red-600 underline" onClick={() => removeSocial(s.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={saveSocial} className="grid gap-3 sm:grid-cols-2">
          <AdminInput
            placeholder="Platform (e.g. instagram)"
            value={socialDraft.platform}
            onChange={(e) => setSocialDraft({ ...socialDraft, platform: e.target.value })}
          />
          <AdminInput
            placeholder="URL"
            value={socialDraft.url}
            onChange={(e) => setSocialDraft({ ...socialDraft, url: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={socialDraft.is_primary}
              onChange={(e) => setSocialDraft({ ...socialDraft, is_primary: e.target.checked })}
            />
            Primary social
          </label>
          <AdminButton type="submit" variant="secondary" disabled={pending}>
            {socialDraft.id ? "Update social" : "Add social"}
          </AdminButton>
        </form>
      </AdminCard>
    </div>
  );
}
