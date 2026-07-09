"use client";

// Drives the audit endpoint batch-by-batch until every conversation is
// graded, with live progress, then refreshes the Insights report.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = { locale: string; total: number; remaining: number };

export default function AuditRunner({ locale, total, remaining }: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const [left, setLeft] = useState(remaining);
  const [running, setRunning] = useState(false);
  const [failedTotal, setFailedTotal] = useState(0);
  const stopRef = useRef(false);

  const run = async () => {
    setRunning(true);
    stopRef.current = false;
    try {
      for (;;) {
        if (stopRef.current) break;
        const res = await fetch("/api/chatbot/admin/audit", { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          audited: number;
          failed: number;
          remaining: number;
        };
        setLeft(data.remaining);
        setFailedTotal((f) => f + data.failed);
        router.refresh(); // report sections update as batches land
        if (data.remaining === 0) break;
        // A batch that only fails would loop forever — bail out.
        if (data.audited === 0 && data.failed > 0) break;
      }
    } catch (e) {
      console.error("audit run failed:", e);
    } finally {
      setRunning(false);
      router.refresh();
    }
  };

  const done = total - left;
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-52">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            {isEn
              ? `${done} of ${total} conversations audited`
              : `تم تحليل ${done} من ${total} محادثة`}
            {failedTotal > 0 ? ` · ${failedTotal} ${isEn ? "failed" : "فشلت"}` : ""}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-nassayem rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {running ? (
        <button
          onClick={() => (stopRef.current = true)}
          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
        >
          {isEn ? "Stop after batch" : "إيقاف بعد الدفعة"}
        </button>
      ) : (
        <button
          onClick={run}
          disabled={left === 0}
          className="px-5 py-2 rounded-xl bg-nassayem text-white text-sm font-medium hover:bg-nassayem-dark disabled:opacity-40"
        >
          {left === 0
            ? isEn ? "✓ All audited" : "✓ اكتمل التحليل"
            : left === total
              ? isEn ? "Run audit" : "بدء التحليل"
              : isEn ? `Continue (${left} left)` : `متابعة (${left} متبقية)`}
        </button>
      )}
      {running && (
        <span className="text-xs text-gray-400 animate-pulse">
          {isEn ? "Grading conversations…" : "جارٍ تحليل المحادثات…"}
        </span>
      )}
    </div>
  );
}
