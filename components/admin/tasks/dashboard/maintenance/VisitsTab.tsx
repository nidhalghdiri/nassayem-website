"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import {
  AlertTriangle, CheckCircle2, Loader2, PackageX, QrCode, RefreshCw, Search, XCircle,
} from "lucide-react";
import { getTechnicianVisitsData } from "@/app/actions/technicianVisits";
import type { TechnicianVisit, TechnicianVisitsData } from "@/lib/reports/technicianVisits";

type Props = {
  locale: string;
  /** Whose visits to show — the dashboard's selected technician. */
  technicianId: string;
};

type StatusFilter = "ALL" | "RESOLVED" | "NEEDS_PARTS" | "UNRESOLVED";

/**
 * "الزيارات" tab on the Maintenance dashboard — the barcode visits this
 * technician logged from /admin/maintenance/scan, newest first. Loaded when
 * the tab opens, and reloaded when the technician changes.
 */
export default function VisitsTab({ locale, technicianId }: Props) {
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;

  const [data, setData] = useState<TechnicianVisitsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setFailed(false);
    const res = await getTechnicianVisitsData(technicianId);
    if (id !== requestId.current) return;
    if (res.ok) setData(res.data);
    else setFailed(true);
  }, [technicianId]);

  // Re-runs when the manager switches technician.
  useEffect(() => { setData(null); load(); }, [load]);

  const t = {
    title: isEn ? "Barcode visits" : "الزيارات بالباركود",
    subtitle: isEn
      ? "Visits logged by scanning a device barcode"
      : "الزيارات المسجّلة عن طريق مسح باركود الجهاز",
    search: isEn ? "Search by code, unit, device or issue…" : "ابحث بالكود أو الوحدة أو الجهاز أو العطل…",
    all: isEn ? "All" : "الكل",
    resolved: isEn ? "Resolved" : "تم الإصلاح",
    needsParts: isEn ? "Needs parts" : "بحاجة لقطع",
    unresolved: isEn ? "Unresolved" : "لم يُحل",
    total: isEn ? "Total visits" : "إجمالي الزيارات",
    empty: isEn ? "No visits recorded yet." : "لم يتم تسجيل أي زيارات بعد.",
    emptyFiltered: isEn ? "No visits match this filter." : "لا توجد زيارات مطابقة لهذا الفلتر.",
    scanNow: isEn ? "Visit by code" : "زيارة بالكود",
    issue: isEn ? "Issue" : "العطل",
    action: isEn ? "Action taken" : "الإجراء المتخذ",
    device: isEn ? "Device" : "الجهاز",
    unit: isEn ? "Unit" : "الوحدة",
    failed: isEn ? "Could not load the visits." : "تعذّر تحميل الزيارات.",
    retry: isEn ? "Try again" : "إعادة المحاولة",
    showing: isEn ? "Showing" : "عرض",
    of: isEn ? "of" : "من",
  };

  const statusMeta: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    RESOLVED: { label: t.resolved, cls: "text-green-700 bg-green-50 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    NEEDS_PARTS: { label: t.needsParts, cls: "text-orange-700 bg-orange-50 border-orange-200", icon: <PackageX className="w-3.5 h-3.5" /> },
    UNRESOLVED: { label: t.unresolved, cls: "text-red-700 bg-red-50 border-red-200", icon: <XCircle className="w-3.5 h-3.5" /> },
  };

  const filtered = useMemo(() => {
    if (!data) return [] as TechnicianVisit[];
    const q = query.trim().toLowerCase();
    return data.visits.filter((v) => {
      if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
      if (!q) return true;
      const typeName = (isEn ? v.equipment.typeNameEn : v.equipment.typeNameAr) ?? v.equipment.typeNameAr;
      const buildingName = isEn ? v.equipment.buildingNameEn : v.equipment.buildingNameAr;
      return [
        v.equipment.qrCode, v.equipment.unitNumber, v.equipment.brandModel,
        typeName, buildingName, v.issueDescription, v.actionTaken,
      ].some((f) => f && f.toLowerCase().includes(q));
    });
  }, [data, query, statusFilter, isEn]);

  if (failed && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-slate-600">{t.failed}</p>
        <button type="button" onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
          {t.retry}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-nassayem" />
      </div>
    );
  }

  const chips: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL", label: t.all, count: data.stats.total },
    { key: "RESOLVED", label: t.resolved, count: data.stats.resolved },
    { key: "NEEDS_PARTS", label: t.needsParts, count: data.stats.needsParts },
    { key: "UNRESOLVED", label: t.unresolved, count: data.stats.unresolved },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">{t.title}</h2>
          <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
        </div>
        <Link
          href={`/${locale}/admin/maintenance/scan`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-nassayem/40 transition-colors shrink-0"
        >
          <QrCode className="w-4 h-4 text-nassayem" />
          {t.scanNow}
        </Link>
      </header>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full ps-9 pe-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatusFilter(c.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-colors ${
                statusFilter === c.key
                  ? "bg-nassayem text-white border-nassayem"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {c.label}
              <span className={`text-[10px] ${statusFilter === c.key ? "text-white/80" : "text-slate-400"}`}>
                {c.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 flex flex-col items-center gap-2 text-center">
          <QrCode className="w-8 h-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {data.stats.total === 0 ? t.empty : t.emptyFiltered}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((v) => {
              const meta = statusMeta[v.status];
              const typeName = (isEn ? v.equipment.typeNameEn : v.equipment.typeNameAr) ?? v.equipment.typeNameAr;
              const buildingName = isEn ? v.equipment.buildingNameEn : v.equipment.buildingNameAr;
              return (
                <article key={v.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/${locale}/admin/maintenance/equipment/${v.equipment.id}`}
                        className="text-sm font-bold text-slate-900 hover:text-nassayem transition-colors"
                      >
                        {typeName}
                        {v.equipment.brandModel ? <span className="text-slate-400 font-medium"> — {v.equipment.brandModel}</span> : null}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span className="font-mono font-bold text-slate-600">{v.equipment.qrCode}</span>
                        {v.equipment.unitNumber ? <span>{t.unit}: {v.equipment.unitNumber}</span> : null}
                        <span>{buildingName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {meta && (
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.cls}`}>
                          {meta.icon}
                          {meta.label}
                        </span>
                      )}
                      <time className="text-xs text-slate-400" dateTime={v.visitDate}>
                        {format(new Date(v.visitDate), "dd MMM yyyy", { locale: dateLocale })}
                      </time>
                    </div>
                  </div>

                  <dl className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{t.issue}</dt>
                      <dd className="text-slate-700 mt-0.5 whitespace-pre-wrap break-words">{v.issueDescription || "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{t.action}</dt>
                      <dd className="text-slate-700 mt-0.5 whitespace-pre-wrap break-words">{v.actionTaken || "—"}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 text-center">
            {t.showing} {filtered.length} {t.of} {data.stats.total}
          </p>
        </>
      )}
    </div>
  );
}
