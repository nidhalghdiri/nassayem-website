"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StayRatingRetryButton({ id, isEn }: { id: string; isEn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stay-ratings/${id}/retry`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) setError(body.error ?? (isEn ? "Sync failed" : "فشلت المزامنة"));
      router.refresh();
    } catch {
      setError(isEn ? "No connection" : "لا يوجد اتصال");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="rounded-lg border border-nassayem px-2.5 py-1 text-xs font-semibold text-nassayem hover:bg-nassayem hover:text-white disabled:opacity-50"
      >
        {busy ? (isEn ? "Syncing…" : "جارٍ المزامنة…") : isEn ? "Retry sync" : "إعادة المزامنة"}
      </button>
      {error && <p className="mt-1 max-w-[16rem] text-xs text-red-600">{error}</p>}
    </div>
  );
}
