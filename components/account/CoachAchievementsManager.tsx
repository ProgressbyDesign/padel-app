"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createCoachAchievement,
  deleteCoachAchievement,
  setCoachAchievementHighlight,
  updateCoachAchievement,
} from "@/app/account/coaches/[coachId]/achievement-actions";
import {
  ActionButton,
  ConfirmActionButton,
} from "@/components/account/RelationshipActionControls";
import type { CoachAchievementRow } from "@/lib/coachAchievements";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm text-primary";

export default function CoachAchievementsManager({
  coachId,
  achievements,
}: {
  coachId: string;
  achievements: CoachAchievementRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState("");
  const [highlight, setHighlight] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editHighlight, setEditHighlight] = useState(false);

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
        <h2 className="text-2xl text-primary">Achievements</h2>
        <p className="mt-2 text-sm text-primary/65">
          Add career highlights and coaching milestones. These are profile
          content and are not verified by Padel Pathways.
        </p>
      </div>

      {achievements.length === 0 ? (
        <p className="text-sm text-primary/55">No achievements yet.</p>
      ) : (
        <ul className="space-y-3">
          {achievements.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-primary/10 bg-white p-4"
            >
              {editingId === item.id ? (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-primary">
                    Title
                    <input
                      className={inputClass}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-primary">
                    Description
                    <textarea
                      className={`${inputClass} min-h-24`}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-primary">
                    Year
                    <input
                      className={inputClass}
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-primary">
                    <input
                      type="checkbox"
                      checked={editHighlight}
                      onChange={(e) => setEditHighlight(e.target.checked)}
                    />
                    Highlight on profile
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      pending={pending}
                      onClick={() =>
                        run(async () => {
                          const result = await updateCoachAchievement(
                            coachId,
                            item.id,
                            {
                              title: editTitle,
                              description: editDescription,
                              year: editYear,
                              is_highlight: editHighlight,
                            }
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
                    <p className="font-semibold text-primary">{item.title}</p>
                    {item.year ? (
                      <p className="mt-1 text-sm text-primary/55">{item.year}</p>
                    ) : null}
                    {item.description ? (
                      <p className="mt-2 text-sm leading-6 text-primary/70">
                        {item.description}
                      </p>
                    ) : null}
                    {item.is_highlight ? (
                      <p className="mt-2 text-xs font-semibold text-amber-900">
                        Highlight
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      pending={pending}
                      tone="secondary"
                      onClick={() =>
                        run(() =>
                          setCoachAchievementHighlight(
                            coachId,
                            item.id,
                            !item.is_highlight
                          )
                        )
                      }
                    >
                      {item.is_highlight ? "Unset highlight" : "Highlight"}
                    </ActionButton>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditTitle(item.title);
                        setEditDescription(item.description ?? "");
                        setEditYear(item.year == null ? "" : String(item.year));
                        setEditHighlight(item.is_highlight);
                      }}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/70"
                    >
                      Edit
                    </button>
                    <ConfirmActionButton
                      label="Delete"
                      confirmLabel="Confirm delete"
                      onConfirm={async () => {
                        const result = await deleteCoachAchievement(
                          coachId,
                          item.id
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

      <section className="rounded-2xl border border-primary/10 bg-white p-4 sm:p-5 space-y-3">
        <h3 className="text-lg text-primary">Add achievement</h3>
        <label className="block text-sm font-semibold text-primary">
          Title
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold text-primary">
          Description <span className="font-normal text-primary/45">(optional)</span>
          <textarea
            className={`${inputClass} min-h-24`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold text-primary">
          Year <span className="font-normal text-primary/45">(optional)</span>
          <input
            className={inputClass}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2022"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-primary">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
          />
          Highlight on profile
        </label>
        <ActionButton
          pending={pending}
          onClick={() =>
            run(async () => {
              const result = await createCoachAchievement(coachId, {
                title,
                description,
                year,
                is_highlight: highlight,
              });
              if (result.ok) {
                setTitle("");
                setDescription("");
                setYear("");
                setHighlight(false);
              }
              return result;
            })
          }
        >
          Add achievement
        </ActionButton>
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
