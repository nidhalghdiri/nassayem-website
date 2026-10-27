"use client";

import React from "react";
import { Download } from "lucide-react";
import type { SummaryRange } from "@/lib/reports/maintenanceSummary";

type Props = {
  isEn: boolean;
  /** Which report to export. */
  report: "equipment" | "other" | "devices";
  /** Period to export; omitted for the device list (it has no period). */
  range?: SummaryRange;
  className?: string;
};

/**
 * Downloads a report as .xlsx with every column from the database — more than
 * the on-screen tables show, so the sheet can be analysed in Excel.
 */
export default function MaintenanceExportButton({ isEn, report, range, className }: Props) {
  const q = new URLSearchParams({ report });
  if (range) {
    q.set("period", range.period);
    if (range.from) q.set("from", range.from);
    if (range.to) q.set("to", range.to);
  }

  return (
    <a
      href={`/api/admin/maintenance/export?${q.toString()}`}
      title={isEn ? "Export all data to Excel" : "تصدير كل البيانات إلى Excel"}
      className={
        className ??
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-nassayem/40 hover:text-nassayem transition-colors shrink-0"
      }
    >
      <Download className="w-3.5 h-3.5" />
      {isEn ? "Export" : "تصدير"}
    </a>
  );
}
