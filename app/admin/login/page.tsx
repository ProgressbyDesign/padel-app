import { Suspense } from "react";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Suspense fallback={<p className="text-sm text-primary/60">Loading…</p>}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
