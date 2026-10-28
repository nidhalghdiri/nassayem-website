"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Building + date-range filter bar for purchase requests.
 *
 * The building option values ARE NetSuite location internal ids
 * (Building.netsuiteId), so the page can hand them to the API as locationIds
 * without another lookup.
 */

type Option = { value: string; label: string };

type Props = {
  isEn: boolean;
  locale: string;
  buildingOptions: Option[];
  current: { tab: string; buildingId: string; from: string; to: string };
};

export default function PurchaseRequestFilters({
  isEn,
  locale,
  buildingOptions,
  current,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [buildingId, setBuildingId] = useState(current.buildingId);
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);

  const apply = (next: { buildingId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (current.tab !== "pending") qs.set("tab", current.tab);
    const b = next.buildingId ?? buildingId;
    const f = next.from ?? from;
    const t = next.to ?? to;
    if (b) qs.set("buildingId", b);
    if (f) qs.set("from", f);
    if (t) qs.set("to", t);
    const q = qs.toString();
    startTransition(() => {
      router.push(`/${locale}/admin/purchase-requests${q ? `?${q}` : ""}`);
    });
  };

  const clear = () => {
    setBuildingId("");
    setFrom("");
    setTo("");
    apply({ buildingId: "", from: "", to: "" });
  };

  const hasFilters = !!(buildingId || from || to);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1 min-w-[12rem] flex-1">
        <label className="text-xs font-semibold text-gray-500">
          {isEn ? "Building" : "المبنى"}
        </label>
        <select
          value={buildingId}
          onChange={(e) => {
            setBuildingId(e.target.value);
            apply({ buildingId: e.target.value });
          }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-nassayem/30 bg-white"
        >
          <option value="">{isEn ? "All buildings" : "جميع المباني"}</option>
          {buildingOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500">
          {isEn ? "From" : "من"}
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={() => apply({})}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-nassayem/30"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500">
          {isEn ? "To" : "إلى"}
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onBlur={() => apply({})}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-nassayem/30"
        />
      </div>

      <button
        type="button"
        onClick={() => apply({})}
        disabled={isPending}
        className="px-4 py-2 rounded-xl bg-nassayem text-white text-sm font-semibold hover:bg-nassayem-dark transition-colors disabled:opacity-60"
      >
        {isPending
          ? isEn
            ? "Loading…"
            : "جارٍ التحميل…"
          : isEn
            ? "Apply"
            : "تطبيق"}
      </button>

      {hasFilters && (
        <button
          type="button"
          onClick={clear}
          disabled={isPending}
          className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:border-gray-300 transition-colors disabled:opacity-60"
        >
          {isEn ? "Clear" : "مسح"}
        </button>
      )}
    </div>
  );
}
