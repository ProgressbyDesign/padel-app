"use client";
import { useState, useTransition } from "react";
import { saveSubmissionNote } from "@/app/account/development/assessments/[orderId]/note-actions";
import { panel, secondaryAction } from "./DevelopmentUi";
export default function SubmissionNote({ orderId, initial }: { orderId: string; initial: string }) {
  const [note, setNote] = useState(initial), [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className={`${panel} mb-6`}><form onSubmit={event => { event.preventDefault(); startTransition(async () => { try { const result = await saveSubmissionNote(orderId, note); setMessage(result.ok ? "Notes saved for your assessor." : "Notes could not be saved. They can only be updated before the first upload."); } catch { setMessage("Connection interrupted. Save your notes again before uploading."); } }); }}><label className="block text-sm font-semibold">Your question for the assessor <span className="font-normal">(optional)</span><textarea maxLength={1000} rows={3} className="mt-2 block w-full rounded-xl border border-primary/20 p-3 font-normal" value={note} onChange={event => setNote(event.target.value)} /></label><p className="mt-2 text-xs text-primary/65">Save before uploading. Notes are shared privately with the assigned assessor.</p><button className={`${secondaryAction} mt-3`} disabled={pending}>{pending ? "Saving…" : "Save notes"}</button>{message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}</form></section>;
}
