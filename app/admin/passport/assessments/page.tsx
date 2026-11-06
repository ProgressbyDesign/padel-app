import { notFound } from "next/navigation";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { reviewExperienceEnabled } from "@/lib/passport/review/access";
import { loadAssessmentAdminPreview, notificationCopy } from "@/lib/passport/review/notifications";
import { prepareAssessmentReminders } from "./actions";

export default async function AssessmentAdminPage() {
  if (!reviewExperienceEnabled() || !hasAdminPermission(await getAdminAccount(), "bookings.manage")) notFound();
  const { watch, intents } = await loadAssessmentAdminPreview();
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8"><h1 className="text-3xl">Assessment watch</h1><p className="rounded-xl bg-amber-50 p-4 text-sm">Local-only notification intentions. No customer email is resolved or delivered. Repeated recording issues are flagged for human review; no refund is automatic.</p><section className="rounded-2xl border bg-white p-5"><h2 className="text-xl">Repeated replacement footage</h2>{watch.length ? <ul className="mt-4 space-y-3">{watch.map(item => <li key={item.order_id} className="break-words text-sm">{item.skill_id} · {item.replacement_count} requests · {item.state}<br /><span className="text-xs">Order {item.order_id}</span></li>)}</ul> : <p className="mt-3 text-sm">No orders with two or more replacement requests.</p>}</section><section className="rounded-2xl border bg-white p-5"><h2 className="text-xl">Notification preparation</h2><form action={prepareAssessmentReminders}><button className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-accent">Prepare deadline reminders (no sending)</button></form><p className="mt-3 text-sm">Within 24 hours is a local reminder threshold, not a new service promise. Unique event keys prevent duplicate intentions.</p><ul className="mt-4 space-y-3">{intents.map(intent => <li key={intent.id} className="break-words rounded-xl bg-surface p-3 text-sm"><strong>{notificationCopy[intent.kind]?.[0] ?? "Notification"}</strong><p className="mt-1">{notificationCopy[intent.kind]?.[1]}</p><p className="mt-2 text-xs">{new Date(intent.created_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · order {intent.order_id} · preview only</p></li>)}</ul></section></main>;
}
