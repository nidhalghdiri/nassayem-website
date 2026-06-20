"use client";

import Link from "next/link";
import { LAUNDRY_STATUS_CONFIG, type TLaundryStatus } from "@/lib/laundry/constants";
import { TASK_PRIORITY_CONFIG, type TTaskPriority } from "@/lib/tasks/constants";
import { isTerminalLaundryStatus } from "@/lib/laundry/workflow";
import { buildingLabel } from "@/lib/buildingLabel";
import type { SerializedLaundryOrder } from "./types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LaundryCard({
  order,
  locale,
}: {
  order: SerializedLaundryOrder;
  locale: string;
}) {
  const isEn = locale === "en";
  const status = LAUNDRY_STATUS_CONFIG[order.status as TLaundryStatus];
  const priority = TASK_PRIORITY_CONFIG[order.priority as TTaskPriority];
  const terminal = isTerminalLaundryStatus(order.status as TLaundryStatus);
  const overdue =
    !terminal && new Date(order.neededDate) < new Date();

  const itemSummary = order.items
    .map((i) => `${isEn ? i.nameEn : i.nameAr} ×${i.requestedQty}`)
    .join(isEn ? ", " : "، ");

  return (
    <Link
      href={`/${locale}/admin/laundry/${order.id}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all p-4 space-y-3"
    >
      {/* Top row: code + status */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold text-gray-500 tracking-wide">
          {order.orderCode}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${status.badge}`}>
          {isEn ? status.labelEn : status.labelAr}
        </span>
      </div>

      {/* Building + priority */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {buildingLabel(order.building, isEn)}
        </p>
        {priority && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${priority.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            {isEn ? priority.labelEn : priority.labelAr}
          </span>
        )}
      </div>

      {/* Items */}
      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{itemSummary}</p>

      {/* Footer: pieces + needed date + discrepancy */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          {order.totalRequested} {isEn ? "pcs" : "قطعة"}
        </span>
        <div className="flex items-center gap-2">
          {order.hasDiscrepancy && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {order.totalMissing} {isEn ? "missing" : "مفقود"}
            </span>
          )}
          <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-gray-500"}`}>
            {isEn ? "Due " : "الموعد "}
            {formatDate(order.neededDate)}
          </span>
        </div>
      </div>
    </Link>
  );
}
