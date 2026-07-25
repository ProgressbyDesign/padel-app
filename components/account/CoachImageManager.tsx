"use client";

import { ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCoachImageAction,
  registerCoachImageAction,
  setPrimaryCoachImageAction,
} from "@/app/account/coaches/[coachId]/image-actions";
import { createClient } from "@/lib/supabase/client";
import {
  createCoachImageStoragePath,
  isManagedCoachImageStoragePath,
  isCoachImageMimeType,
  managedCoachImageStoragePathFromUrl,
  MAX_COACH_IMAGE_BYTES,
  MAX_COACH_IMAGES,
  MAX_COACH_UPLOAD_BATCH,
  COACH_IMAGES_BUCKET,
  type CoachImageRow,
} from "@/lib/coachImages";

type SelectedUpload = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "success" | "error";
  message: string;
};

function validateFile(file: File): string | null {
  if (file.size <= 0) return "The file is empty.";
  if (!isCoachImageMimeType(file.type)) {
    return "Only JPEG, PNG and WebP files are supported.";
  }
  if (file.size > MAX_COACH_IMAGE_BYTES) {
    return "The file is larger than 8 MB.";
  }
  return null;
}

export default function CoachImageManager({
  coachId,
  coachName,
  images,
}: {
  coachId: string;
  coachName: string;
  images: CoachImageRow[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mutationPending, startMutation] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const primary = images.find((image) => image.is_primary) ?? null;
  const remaining = primary
    ? images.filter((image) => image.id !== primary.id)
    : images;
  const remainingCapacity = Math.max(MAX_COACH_IMAGES - images.length, 0);
  const busy = uploading || mutationPending;
  const canUpload =
    selected.length > 0 &&
    selected.every((item) => item.status === "queued") &&
    !busy;

  function chooseFiles(fileList: FileList | null) {
    setMessage(null);
    setWarning(null);
    setError(null);

    const files = Array.from(fileList ?? []);
    if (files.length > MAX_COACH_UPLOAD_BATCH) {
      setSelected([]);
      setError(`Choose no more than ${MAX_COACH_UPLOAD_BATCH} files at once.`);
      return;
    }
    if (files.length > remainingCapacity) {
      setSelected([]);
      setError(
        `Only ${remainingCapacity} image${
          remainingCapacity === 1 ? "" : "s"
        } can be added before reaching the coach limit.`
      );
      return;
    }

    setSelected(
      files.map((file) => {
        const validationError = validateFile(file);
        return {
          id: crypto.randomUUID(),
          file,
          status: validationError ? "error" : "queued",
          message: validationError ?? "Ready to upload.",
        };
      })
    );
  }

  function updateSelected(
    id: string,
    patch: Pick<SelectedUpload, "status" | "message">
  ) {
    setSelected((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function uploadSelected() {
    if (!canUpload) return;
    setUploading(true);
    setMessage(null);
    setWarning(null);
    setError(null);

    const supabase = createClient();
    let successes = 0;

    for (const item of selected) {
      updateSelected(item.id, {
        status: "uploading",
        message: "Uploading…",
      });

      if (!isCoachImageMimeType(item.file.type)) {
        updateSelected(item.id, {
          status: "error",
          message: "Unsupported image type.",
        });
        continue;
      }

      const storagePath = createCoachImageStoragePath(
        coachId,
        item.file.type
      );
      if (!isManagedCoachImageStoragePath(storagePath, coachId)) {
        updateSelected(item.id, {
          status: "error",
          message: "A safe upload path could not be created.",
        });
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(COACH_IMAGES_BUCKET)
        .upload(storagePath, item.file, {
          contentType: item.file.type,
          upsert: false,
        });

      if (uploadError) {
        updateSelected(item.id, {
          status: "error",
          message: "Storage upload failed.",
        });
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from(COACH_IMAGES_BUCKET)
        .getPublicUrl(storagePath);
      if (!publicUrlData.publicUrl) {
        await supabase.storage.from(COACH_IMAGES_BUCKET).remove([storagePath]);
        updateSelected(item.id, {
          status: "error",
          message: "The public image URL could not be created.",
        });
        continue;
      }

      const result = await registerCoachImageAction(coachId, storagePath);
      if (!result.ok) {
        await supabase.storage.from(COACH_IMAGES_BUCKET).remove([storagePath]);
        updateSelected(item.id, {
          status: "error",
          message: result.message,
        });
        continue;
      }

      successes += 1;
      updateSelected(item.id, {
        status: "success",
        message: "Uploaded.",
      });
    }

    setUploading(false);
    if (successes > 0) {
      setMessage(
        `${successes} image${successes === 1 ? "" : "s"} uploaded successfully.`
      );
      router.refresh();
    } else {
      setError("No images were uploaded.");
    }
  }

  function setPrimary(imageId: string) {
    setMessage(null);
    setWarning(null);
    setError(null);
    startMutation(async () => {
      const result = await setPrimaryCoachImageAction(coachId, imageId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  function deleteImage(imageId: string) {
    setMessage(null);
    setWarning(null);
    setError(null);
    startMutation(async () => {
      const result = await deleteCoachImageAction(coachId, imageId);
      setConfirmDeleteId(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setWarning(result.warning ?? null);
      router.refresh();
    });
  }

  function renderImageCard(image: CoachImageRow, position: number) {
    const legacy =
      managedCoachImageStoragePathFromUrl(image.image_url, coachId) === null;
    const confirming = confirmDeleteId === image.id;

    return (
      <article
        key={image.id}
        className="overflow-hidden rounded-2xl border border-primary/10 bg-white"
      >
        <div className="relative aspect-[4/3] bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- imported legacy URLs may use unconfigured hosts. */}
          <img
            src={image.image_url}
            alt={`${coachName} coach image ${position}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {image.is_primary ? (
            <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary shadow-sm">
              Primary
            </span>
          ) : null}
        </div>

        <div className="space-y-3 p-3">
          {confirming ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-3"
              role="alertdialog"
              aria-label="Confirm image deletion"
            >
              <p className="text-sm font-semibold text-red-900">
                Delete this image?
              </p>
              <p className="mt-1 text-xs leading-5 text-red-800">
                {legacy
                  ? "The gallery row will be removed, but the legacy Storage object will remain."
                  : "The gallery row and managed Storage object will be removed."}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => deleteImage(image.id)}
                  className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!image.is_primary ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPrimary(image.id)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/15 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-surface disabled:opacity-50"
                >
                  <Star className="h-3.5 w-3.5" aria-hidden />
                  Set primary
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDeleteId(image.id)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">coach images</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-primary/60">
            Upload a clear headshot or coaching photo. JPEG, PNG or WebP up to
            8 MB.
          </p>
        </div>
        <span className="self-start rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-primary/70">
          {images.length} / {MAX_COACH_IMAGES} images
        </span>
      </div>

      <div className="mt-5 space-y-2" aria-live="polite">
        {message ? (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {message}
          </p>
        ) : null}
        {warning ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {warning}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-primary/20 bg-surface/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary">
            <ImagePlus className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">Upload images</p>
            <p className="mt-1 text-xs leading-5 text-primary/55">
              JPEG, PNG or WebP. Maximum 8 MB each and 4 files per batch.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy || remainingCapacity === 0}
          onChange={(event) => chooseFiles(event.target.files)}
          className="mt-4 block w-full text-sm text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-accent disabled:opacity-50"
        />

        {selected.length > 0 ? (
          <ul className="mt-4 space-y-2" aria-label="Selected upload files">
            {selected.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate text-primary">
                  Image {index + 1}
                </span>
                <span
                  className={
                    item.status === "error"
                      ? "text-red-700"
                      : item.status === "success"
                        ? "text-emerald-700"
                        : "text-primary/55"
                  }
                >
                  {item.message}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          disabled={!canUpload}
          onClick={uploadSelected}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" aria-hidden />
          {uploading ? "Uploading…" : "Upload selected"}
        </button>
      </div>

      {images.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-primary/10 bg-surface/60 p-8 text-center">
          <p className="text-sm font-semibold text-primary">No gallery images yet</p>
          <p className="mt-1 text-sm text-primary/55">
            The first successful upload will become the primary image.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-7">
          {primary ? (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/45">
                Current primary image
              </h3>
              <div className="mt-3 max-w-2xl">
                {renderImageCard(primary, 1)}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No primary image is selected. Choose one from the gallery.
            </p>
          )}

          {remaining.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/45">
                Gallery images
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {remaining.map((image, index) =>
                  renderImageCard(image, primary ? index + 2 : index + 1)
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
