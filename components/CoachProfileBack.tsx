"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function CoachProfileBack() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const href = from === "venues" ? "/venues" : "/coaches";
  const label = from === "venues" ? "Back to venues" : "Back to coaches";

  return (
    <Link
      href={href}
      className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary/70 transition hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}
