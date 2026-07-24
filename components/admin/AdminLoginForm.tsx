"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { adminLogin } from "@/app/actions/admin";
import { AdminButton, AdminInput } from "./ui";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const configError = searchParams.get("error") === "config";
  const nextPath = searchParams.get("next") ?? "/admin/data-quality";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await adminLogin(password);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push(nextPath.startsWith("/admin") ? nextPath : "/admin/data-quality");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-lg border border-primary/10 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-primary">Admin sign in</h1>
      {configError ? (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Set <code className="text-xs">ADMIN_SECRET</code> in <code className="text-xs">.env.local</code> to
          enable admin access.
        </p>
      ) : null}
      <label className="block text-sm text-primary/80">
        Password
        <AdminInput
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1"
          required
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <AdminButton type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </AdminButton>
      <p className="text-xs text-primary/50">
        TODO: Supabase Auth with admin role. For now, password matches server{" "}
        <code className="text-[10px]">ADMIN_SECRET</code>.
      </p>
    </form>
  );
}
