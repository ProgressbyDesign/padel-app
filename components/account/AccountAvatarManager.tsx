"use client";

import { ImagePlus, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  registerAccountAvatarAction,
  removeAccountAvatarAction,
} from "@/app/account/settings/actions";
import AccountAvatar from "@/components/account/AccountAvatar";
import { createClient } from "@/lib/supabase/client";
import {
  ACCOUNT_AVATARS_BUCKET,
  accountAvatarStoragePath,
  isAccountAvatarMimeType,
  isAccountAvatarStoragePath,
  MAX_ACCOUNT_AVATAR_BYTES,
} from "@/lib/accountAvatar";

function validateFile(file: File): string | null {
  if (file.size <= 0) return "The file is empty.";
  if (!isAccountAvatarMimeType(file.type)) {
    return "Only JPEG, PNG and WebP files are supported.";
  }
  if (file.size > MAX_ACCOUNT_AVATAR_BYTES) {
    return "The file is larger than 5 MB.";
  }
  return null;
}

export default function AccountAvatarManager({
  userId,
  fullName,
  email,
  avatarUrl,
}: {
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [mutationPending, startMutation] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const busy = uploading || mutationPending;

  async function uploadFile(file: File) {
    setMessage(null);
    setWarning(null);
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedName(null);
      return;
    }

    setSelectedName(file.name);
    setUploading(true);

    const supabase = createClient();
    let storagePath: string;
    try {
      storagePath = accountAvatarStoragePath(userId);
    } catch {
      setUploading(false);
      setError("A safe upload path could not be created.");
      return;
    }

    if (!isAccountAvatarStoragePath(storagePath, userId)) {
      setUploading(false);
      setError("A safe upload path could not be created.");
      return;
    }

    if (!isAccountAvatarMimeType(file.type)) {
      setUploading(false);
      setError("Unsupported image type.");
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from(ACCOUNT_AVATARS_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      setUploading(false);
      setError("Storage upload failed.");
      return;
    }

    const result = await registerAccountAvatarAction(storagePath);
    setUploading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMessage(result.message);
    setSelectedName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  function removeAvatar() {
    setMessage(null);
    setWarning(null);
    setError(null);
    startMutation(async () => {
      const result = await removeAccountAvatarAction();
      setConfirmRemove(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setWarning(result.warning ?? null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <AccountAvatar
          url={avatarUrl}
          name={fullName}
          email={email}
          size="lg"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">
            {avatarUrl ? "Current profile photo" : "No profile photo yet"}
          </p>
          <p className="mt-1 text-sm leading-6 text-primary/60">
            JPEG, PNG or WebP up to 5 MB. Replacing uploads overwrite the same
            Storage path.
          </p>
        </div>
      </div>

      <div className="space-y-2" aria-live="polite">
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

      <div className="rounded-2xl border border-dashed border-primary/20 bg-surface/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary">
            <ImagePlus className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">
              {avatarUrl ? "Replace photo" : "Upload photo"}
            </p>
            <p className="mt-1 text-xs leading-5 text-primary/55">
              Choose a clear square headshot for best results.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
          }}
          className="mt-4 block w-full text-sm text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-accent disabled:opacity-50"
        />

        {selectedName ? (
          <p className="mt-3 text-sm text-primary/60">
            {uploading ? "Uploading…" : selectedName}
          </p>
        ) : null}

        <p className="mt-3 inline-flex items-center gap-2 text-xs text-primary/45">
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Upload starts as soon as a file is chosen.
        </p>
      </div>

      {avatarUrl ? (
        confirmRemove ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-4"
            role="alertdialog"
            aria-label="Confirm profile photo removal"
          >
            <p className="text-sm font-semibold text-red-900">
              Remove your profile photo?
            </p>
            <p className="mt-1 text-xs leading-5 text-red-800">
              The Storage object and profile reference will both be cleared.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={removeAvatar}
                className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Confirm remove
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmRemove(false)}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmRemove(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove photo
          </button>
        )
      ) : null}
    </div>
  );
}
