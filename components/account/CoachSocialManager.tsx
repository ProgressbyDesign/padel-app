"use client";

import {
  ExternalLink,
  Pencil,
  Plus,
  Star,
  Trash2,
  X as CloseIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createCoachSocialAction,
  deleteCoachSocialAction,
  setPrimaryCoachSocialAction,
  updateCoachSocialAction,
} from "@/app/account/coaches/[coachId]/social-actions";
import SocialPlatformIcon from "@/components/social/SocialPlatformIcon";
import {
  COACH_SOCIAL_PLATFORMS,
  coachSocialPlatformLabel,
  coachSocialVisibleUrl,
  isCoachSocialPlatform,
  normalizeCoachSocialUrl,
  normalizeSafeCoachHttpsUrl,
  type CoachSocialPlatform,
  type CoachSocialRow,
} from "@/lib/coachSocials";

type EditorState = {
  mode: "add" | "edit";
  socialId: string | null;
  platform: CoachSocialPlatform;
  url: string;
  isPrimary: boolean;
  fieldErrors: {
    platform?: string;
    url?: string;
  };
};

function socialHref(social: CoachSocialRow): string | null {
  if (isCoachSocialPlatform(social.platform)) {
    const result = normalizeCoachSocialUrl(social.platform, social.url);
    return result.ok ? result.value : null;
  }
  return normalizeSafeCoachHttpsUrl(social.url);
}

export default function CoachSocialManager({
  coachId,
  socials,
}: {
  coachId: string;
  socials: CoachSocialRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usedPlatforms = new Set(
    socials
      .map((social) => social.platform)
      .filter(isCoachSocialPlatform)
  );
  const supportedCount = usedPlatforms.size;
  const availablePlatforms = COACH_SOCIAL_PLATFORMS.filter(
    (option) =>
      !usedPlatforms.has(option.value) || option.value === editor?.platform
  );

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  function startAdd() {
    const firstAvailable = COACH_SOCIAL_PLATFORMS.find(
      (option) => !usedPlatforms.has(option.value)
    );
    if (!firstAvailable) return;
    clearFeedback();
    setConfirmDeleteId(null);
    setEditor({
      mode: "add",
      socialId: null,
      platform: firstAvailable.value,
      url: "",
      isPrimary: socials.length === 0,
      fieldErrors: {},
    });
  }

  function startEdit(social: CoachSocialRow) {
    if (!isCoachSocialPlatform(social.platform)) return;
    clearFeedback();
    setConfirmDeleteId(null);
    setEditor({
      mode: "edit",
      socialId: String(social.id),
      platform: social.platform,
      url: social.url,
      isPrimary: social.is_primary,
      fieldErrors: {},
    });
  }

  function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    clearFeedback();

    const normalized = normalizeCoachSocialUrl(editor.platform, editor.url);
    if (!normalized.ok) {
      setEditor({
        ...editor,
        fieldErrors: { url: normalized.error },
      });
      setError("Check the highlighted fields and try again.");
      return;
    }

    startTransition(async () => {
      const input = {
        platform: editor.platform,
        url: normalized.value,
        isPrimary: editor.isPrimary,
      };
      const result =
        editor.mode === "edit" && editor.socialId
          ? await updateCoachSocialAction(coachId, editor.socialId, input)
          : await createCoachSocialAction(coachId, input);

      if (!result.ok) {
        setError(result.message);
        setEditor((current) =>
          current
            ? {
                ...current,
                fieldErrors: result.fieldErrors ?? {},
              }
            : current
        );
        return;
      }

      setEditor(null);
      setMessage(result.message);
      router.refresh();
    });
  }

  function setPrimary(socialId: string) {
    clearFeedback();
    setConfirmDeleteId(null);
    startTransition(async () => {
      const result = await setPrimaryCoachSocialAction(coachId, socialId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  function deleteSocial(socialId: string) {
    clearFeedback();
    startTransition(async () => {
      const result = await deleteCoachSocialAction(coachId, socialId);
      setConfirmDeleteId(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (editor?.socialId === socialId) setEditor(null);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl text-primary">Social links</h2>
          <p className="mt-1 text-sm leading-6 text-primary/60">
            Help players find you on your official social channels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-primary/70">
            {supportedCount} / {COACH_SOCIAL_PLATFORMS.length}
          </span>
          <button
            type="button"
            disabled={pending || supportedCount >= COACH_SOCIAL_PLATFORMS.length}
            onClick={startAdd}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add social link
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2" aria-live="polite">
        {message ? (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {message}
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

      {editor ? (
        <form
          onSubmit={submitEditor}
          className="mt-5 rounded-2xl border border-primary/10 bg-surface/70 p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-primary">
              {editor.mode === "add" ? "Add social link" : "Edit social link"}
            </h3>
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditor(null)}
              aria-label="Close social link form"
              className="flex h-9 w-9 items-center justify-center rounded-full text-primary/60 transition hover:bg-white hover:text-primary disabled:opacity-50"
            >
              <CloseIcon className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
            <label className="text-sm font-medium text-primary">
              Platform
              <select
                value={editor.platform}
                disabled={pending}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    platform: event.target.value as CoachSocialPlatform,
                    fieldErrors: {},
                  })
                }
                aria-invalid={Boolean(editor.fieldErrors.platform) || undefined}
                aria-describedby={
                  editor.fieldErrors.platform
                    ? "coach-social-platform-error"
                    : undefined
                }
                className="mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
              >
                {availablePlatforms.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {editor.fieldErrors.platform ? (
                <span
                  id="coach-social-platform-error"
                  className="mt-1.5 block text-sm text-red-700"
                >
                  {editor.fieldErrors.platform}
                </span>
              ) : null}
            </label>

            <label className="text-sm font-medium text-primary">
              Profile URL
              <input
                type="url"
                required
                maxLength={2048}
                value={editor.url}
                disabled={pending}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    url: event.target.value,
                    fieldErrors: {},
                  })
                }
                placeholder={`https://${COACH_SOCIAL_PLATFORMS.find(
                  (option) => option.value === editor.platform
                )?.hosts[0]}/your-profile`}
                aria-invalid={Boolean(editor.fieldErrors.url) || undefined}
                aria-describedby={
                  editor.fieldErrors.url ? "coach-social-url-error" : undefined
                }
                className="mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
              />
              {editor.fieldErrors.url ? (
                <span
                  id="coach-social-url-error"
                  className="mt-1.5 block text-sm text-red-700"
                >
                  {editor.fieldErrors.url}
                </span>
              ) : null}
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-primary">
              <input
                type="checkbox"
                checked={editor.isPrimary}
                disabled={pending}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    isPrimary: event.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-primary/25 accent-primary"
              />
              Primary social link
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditor(null)}
                className="min-h-10 rounded-xl border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-50"
              >
                {pending
                  ? "Saving…"
                  : editor.mode === "add"
                    ? "Add link"
                    : "Save link"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {socials.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-primary/15 bg-surface/60 px-5 py-7 text-center text-sm text-primary/55">
          No social links added yet.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-primary/10 overflow-hidden rounded-2xl border border-primary/10">
          {socials.map((social) => {
            const socialId = String(social.id);
            const supported = isCoachSocialPlatform(social.platform);
            const href = socialHref(social);
            const confirming = confirmDeleteId === socialId;

            return (
              <li key={socialId} className="bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <SocialPlatformIcon platform={social.platform} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-primary">
                          {supported
                            ? coachSocialPlatformLabel(social.platform)
                            : social.platform || "Unknown platform"}
                        </p>
                        {social.is_primary ? (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-primary">
                            Primary
                          </span>
                        ) : null}
                        {!supported ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Legacy · read-only
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-primary/55">
                        {coachSocialVisibleUrl(social.url)}
                      </p>
                    </div>
                  </div>

                  {!confirming ? (
                    <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary/70 transition hover:bg-surface hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Open
                        </a>
                      ) : null}
                      {supported ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => startEdit(social)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary/70 transition hover:bg-surface hover:text-primary disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                      ) : null}
                      {supported && !social.is_primary ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setPrimary(socialId)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary/70 transition hover:bg-surface hover:text-primary disabled:opacity-50"
                        >
                          <Star className="h-3.5 w-3.5" aria-hidden />
                          Set primary
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          clearFeedback();
                          setConfirmDeleteId(socialId);
                        }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div
                      role="alertdialog"
                      aria-label="Confirm social link deletion"
                      className="rounded-xl border border-red-200 bg-red-50 p-3 sm:max-w-sm"
                    >
                      <p className="text-sm font-semibold text-red-900">
                        Delete this social link?
                      </p>
                      <p className="mt-1 text-sm text-red-800">
                        {social.is_primary
                          ? "This will leave the coach without a primary social link."
                          : "This removes the link from the coach profile."}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => deleteSocial(socialId)}
                          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
