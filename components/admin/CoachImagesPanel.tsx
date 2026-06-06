"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  addCoachImageUrlAdmin,
  deleteCoachImageAdmin,
  setPrimaryCoachImageAdmin,
  uploadCoachImageAdmin,
} from "@/app/actions/admin";
import type { CoachImageRow } from "@/lib/admin/types";
import { resolveCoachImageUrl } from "@/lib/coachImageResolve";
import { AdminBadge, AdminButton, AdminCard, AdminInput } from "./ui";

export default function CoachImagesPanel({
  coachId,
  fallbackImageUrl,
  images,
}: {
  coachId: string;
  fallbackImageUrl: string | null;
  images: CoachImageRow[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const resolvedPreview = resolveCoachImageUrl(images, fallbackImageUrl);

  function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose an image file first.");
      return;
    }
    const fd = new FormData();
    fd.set("coachId", coachId);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadCoachImageAdmin(fd);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setMessage("Image uploaded.");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  function onAddUrl(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await addCoachImageUrlAdmin(coachId, imageUrl);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setImageUrl("");
      setMessage("Image URL added.");
      router.refresh();
    });
  }

  return (
    <AdminCard>
      <h2 className="font-semibold text-primary">Images</h2>
      <p className="mt-1 text-sm text-primary/60">
        Primary image is used on coach cards and profile pages. Upload adds a new coach_images row;
        existing images are never overwritten.
      </p>
      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {resolvedPreview ? (
        <div className="mt-4 flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-primary/5 ring-1 ring-primary/10">
            <Image src={resolvedPreview} alt="" fill className="object-cover" unoptimized />
          </div>
          <p className="text-xs text-primary/50">Current site preview.</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-primary/50">No image on the public site yet.</p>
      )}
      <form onSubmit={onUpload} className="mt-4 space-y-2 border-t border-primary/10 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">Upload file</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="block w-full max-w-md text-sm text-primary"
        />
        <AdminButton type="submit" variant="secondary" disabled={pending}>
          {pending ? "Uploading..." : "Upload to Supabase Storage"}
        </AdminButton>
        <p className="text-[11px] text-primary/45">Bucket: coach-images. Max 5 MB.</p>
      </form>
      <form onSubmit={onAddUrl} className="mt-4 flex flex-wrap gap-2 border-t border-primary/10 pt-4">
        <p className="w-full text-xs font-semibold uppercase tracking-wide text-primary/50">Add image URL</p>
        <AdminInput
          type="url"
          placeholder="https://..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="max-w-md flex-1"
        />
        <AdminButton type="submit" variant="secondary" disabled={pending || !imageUrl.trim()}>
          Add URL
        </AdminButton>
      </form>
      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary/50">
          coach_images ({images.length})
        </p>
        {images.length === 0 ? (
          <p className="text-sm text-primary/50">No rows yet.</p>
        ) : (
          <ul className="space-y-4">
            {images.map((img) => (
              <li key={img.id} className="flex flex-wrap items-start gap-4 rounded-lg border border-primary/10 bg-surface/50 p-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-primary/5">
                  <Image src={img.image_url} alt="" fill className="object-cover" unoptimized />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-all text-xs text-primary/70">{img.image_url}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {img.is_primary ? (
                      <AdminBadge tone="ok">Primary</AdminBadge>
                    ) : (
                      <AdminButton
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await setPrimaryCoachImageAdmin(coachId, img.id);
                            if (!res.ok) setError(res.message);
                            else router.refresh();
                          });
                        }}
                      >
                        Set primary
                      </AdminButton>
                    )}
                    <button
                      type="button"
                      className="text-xs text-red-600 underline"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("Remove this image row? Storage file is not deleted.")) return;
                        startTransition(async () => {
                          const res = await deleteCoachImageAdmin(img.id, coachId);
                          if (!res.ok) setError(res.message);
                          else router.refresh();
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminCard>
  );
}