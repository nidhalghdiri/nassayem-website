"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Search, ChevronRight } from "lucide-react";

type Device = {
  id: string;
  qrCode: string;
  unitNumber: string | null;
  brandModel: string | null;
  status: string;
  typeId: string;
  type?: { nameEn: string | null; nameAr: string } | null;
  building?: { nameEn: string; nameAr: string; shortName: string | null } | null;
  visits?: { visitDate: string | Date }[];
  _count?: { visits: number };
};

type Props = {
  isEn: boolean;
  locale: string;
  title: string;
  accentClass: string;
  devices: Device[];
  onClose: () => void;
};

const STATUS_AR: Record<string, string> = {
  GOOD: "جيدة",
  NEEDS_REPAIR: "يحتاج صيانة",
  NEEDS_REPLACEMENT: "يحتاج استبدال",
  OUT_OF_SERVICE: "خارج الخدمة",
};
const STATUS_EN: Record<string, string> = {
  GOOD: "Good",
  NEEDS_REPAIR: "Needs repair",
  NEEDS_REPLACEMENT: "Needs replacement",
  OUT_OF_SERVICE: "Out of service",
};
const STATUS_CLS: Record<string, string> = {
  GOOD: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NEEDS_REPAIR: "bg-red-50 text-red-700 border-red-200",
  NEEDS_REPLACEMENT: "bg-orange-50 text-orange-700 border-orange-200",
  OUT_OF_SERVICE: "bg-slate-100 text-slate-600 border-slate-200",
};

/** Device list behind an "Equipment list" summary card. */
export default function DeviceListModal({ isEn, locale, title, accentClass, devices, onClose }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) =>
      [
        d.qrCode, d.unitNumber ?? "", d.brandModel ?? "",
        d.type?.nameAr ?? "", d.type?.nameEn ?? "",
        d.building?.nameAr ?? "", d.building?.nameEn ?? "", d.building?.shortName ?? "",
      ].some((v) => v.toLowerCase().includes(q)),
    );
  }, [devices, query]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-3xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black ${accentClass}`}>
              {devices.length}
            </span>
            <h3 className="font-bold text-slate-800 truncate">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={isEn ? "Close" : "إغلاق"}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isEn ? "Search by code, unit, device or building…" : "ابحث بالكود أو الوحدة أو الجهاز أو المبنى…"}
              className="w-full ps-9 pe-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center py-10 text-sm text-slate-500">{isEn ? "No devices found." : "لا توجد أجهزة."}</p>
          ) : (
            filtered.map((d) => {
              const typeName = (isEn ? d.type?.nameEn || d.type?.nameAr : d.type?.nameAr) ?? "—";
              const buildingName = isEn
                ? d.building?.shortName || d.building?.nameEn
                : d.building?.shortName || d.building?.nameAr;
              return (
                <Link
                  key={d.id}
                  href={`/${locale}/admin/maintenance/equipment/${d.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-nassayem/40 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {typeName}
                      {d.brandModel ? <span className="text-slate-400 font-medium"> — {d.brandModel}</span> : null}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                      <span className="font-mono font-bold text-slate-600">{d.qrCode}</span>
                      {d.unitNumber ? <span>{isEn ? "Unit" : "الوحدة"}: {d.unitNumber}</span> : null}
                      {buildingName ? <span>{buildingName}</span> : null}
                      {d._count?.visits !== undefined && (
                        <span>{d._count.visits} {isEn ? "visits" : "زيارة"}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-md border shrink-0 ${STATUS_CLS[d.status] ?? STATUS_CLS.OUT_OF_SERVICE}`}>
                    {isEn ? STATUS_EN[d.status] ?? d.status : STATUS_AR[d.status] ?? d.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
