"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";

type SelectOption = { value: string; label: string };

type Props = {
  isEn: boolean;
  /** Placeholder for the free-text search box. */
  placeholder: string;
  /** Current values reflected from the URL. */
  current: {
    q: string;
    from: string;
    to: string;
    status: string;
    building?: string;
    createdBy?: string;
  };
  /** Base path of the Excel export route, e.g. "/api/admin/bookings/export". */
  exportPath: string;
  /** Optional Building dropdown (NetSuite Payments list). */
  buildingOptions?: SelectOption[];
  /** Optional "Created By" dropdown (NetSuite Payments list). */
  createdByOptions?: SelectOption[];
};

/**
 * Reusable admin list filter bar: free-text search + a payment-date range
 * (from / to) + an "Export to Excel" button. Status (set by the tab strip on
 * the page) is preserved across navigations. Used by both the Bookings and
 * NetSuite Payments admin lists.
 */
export default function ListFilterBar({
  isEn,
  placeholder,
  current,
  exportPath,
  buildingOptions,
  createdByOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(current.q);
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);
  const [building, setBuilding] = useState(current.building ?? "");
  const [createdBy, setCreatedBy] = useState(current.createdBy ?? "");

  const buildParams = (overrides?: Partial<Props["current"]>) => {
    const values = { q, from, to, status: current.status, building, createdBy, ...overrides };
    const params = new URLSearchParams();
    if (values.status && values.status !== "ALL")
      params.set("status", values.status);
    if (values.q.trim()) params.set("q", values.q.trim());
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);
    if (values.building) params.set("buildingId", values.building);
    if (values.createdBy) params.set("createdBy", values.createdBy);
    return params;
  };

  const apply = (overrides?: Partial<Props["current"]>) => {
    const params = buildParams(overrides);
    startTransition(() => {
      router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
    });
  };

  const clearAll = () => {
    setQ("");
    setFrom("");
    setTo("");
    setBuilding("");
    setCreatedBy("");
    apply({ q: "", from: "", to: "", building: "", createdBy: "" });
  };

  const hasFilters = !!(q || from || to || building || createdBy);
  const exportHref = `${exportPath}${buildParams().toString() ? `?${buildParams()}` : ""}`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        {/* Search */}
        <div className="flex-1 min-w-0">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            {isEn ? "Search" : "بحث"}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
              placeholder={placeholder}
              className="w-full bg-white border border-gray-200 rounded-xl ps-10 pe-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
            />
          </div>
        </div>

        {/* Building */}
        {buildingOptions && (
          <div className="w-full lg:w-48">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {isEn ? "Building" : "المبنى"}
            </label>
            <select
              value={building}
              onChange={(e) => {
                setBuilding(e.target.value);
                apply({ building: e.target.value });
              }}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
            >
              <option value="">{isEn ? "All buildings" : "كل المباني"}</option>
              {buildingOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Created By */}
        {createdByOptions && (
          <div className="w-full lg:w-52">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {isEn ? "Created by" : "أنشأه"}
            </label>
            <select
              value={createdBy}
              onChange={(e) => {
                setCreatedBy(e.target.value);
                apply({ createdBy: e.target.value });
              }}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
            >
              <option value="">{isEn ? "All staff" : "كل الموظفين"}</option>
              {createdByOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* From date */}
        <div className="w-full lg:w-44">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            {isEn ? "Payment from" : "الدفع من"}
          </label>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              apply({ from: e.target.value });
            }}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
          />
        </div>

        {/* To date */}
        <div className="w-full lg:w-44">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            {isEn ? "Payment to" : "الدفع إلى"}
          </label>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              apply({ to: e.target.value });
            }}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => apply()}
            className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold bg-nassayem text-white hover:bg-nassayem/90 transition-colors"
          >
            {isEn ? "Apply" : "تطبيق"}
          </button>
          <a
            href={exportHref}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {isEn ? "Export Excel" : "تصدير Excel"}
          </a>
        </div>
      </div>

      {hasFilters && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {isEn
              ? "Date range filters by payment date."
              : "نطاق التاريخ يُصفّي حسب تاريخ الدفع."}
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-gray-500 hover:text-nassayem transition-colors"
          >
            {isEn ? "Clear filters" : "مسح عوامل التصفية"}
          </button>
        </div>
      )}
    </div>
  );
}
