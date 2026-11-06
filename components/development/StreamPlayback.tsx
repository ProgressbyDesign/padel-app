"use client";
import { useEffect, useState } from "react";

export default function StreamPlayback({ orderId, title, attemptId }: { orderId: string; title: string; attemptId?: string }) {
  const [url, setUrl] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`/account/development/assessments/${orderId}/playback${attemptId ? `?attempt=${encodeURIComponent(attemptId)}` : ""}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw Error("Private playback is unavailable. Your access may have changed.");
        const body = await response.json(); if (!controller.signal.aborted) { setUrl(body.url); setError(""); }
      } catch (reason) { if (!controller.signal.aborted) { setUrl(""); setError(reason instanceof Error ? reason.message : "Video unavailable."); } }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 90000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [orderId, attemptId]);
  return <div className="mt-4">{error ? <p role="alert" className="text-sm text-red-800">{error}</p> : url ? <iframe src={url} title={`Private ${title} video`} referrerPolicy="no-referrer" allow="fullscreen" allowFullScreen className="aspect-video w-full rounded-xl border-0 bg-primary" /> : <p role="status">Loading private playback…</p>}</div>;
}
