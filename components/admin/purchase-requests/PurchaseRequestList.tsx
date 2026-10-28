"use client";

import Link from "next/link";
import type { PurchaseRequestRow } from "@/lib/netsuitePurchaseRequests";
import {
  PRIORITY_BADGE_STYLES,
  STATUS_BADGE_STYLES,
  formatDate,
  formatOmr,
  priorityLabel,
  statusLabel,
} from "@/lib/purchaseRequestFormat";

/**
 * The purchase request list. A table on desktop, stacked cards on mobile —
 * supervisors mostly approve from a phone.
 *
 * Rows link to `?id=<netsuite id>`, which the server page turns into the detail
 * modal. A link (not a button) so the detail view is shareable and survives a
 * refresh; the decision itself is a Server Action, never a link.
 */

type Props = {
  rows: PurchaseRequestRow[];
  isEn: boolean;
  locale: string;
  tab: string;
  buildingId: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  paginated: boolean;
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export default function PurchaseRequestList({
  rows,
  isEn,
  locale,
  tab,
  buildingId,
  from,
  to,
  page,
  pageSize,
  total,
  paginated,
}: Props) {
  const hrefFor = (row: PurchaseRequestRow) => {
    const qs = new URLSearchParams();
    if (tab !== "pending") qs.set("tab", tab);
    if (buildingId) qs.set("buildingId", buildingId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (page) qs.set("page", String(page));
    qs.set("id", row.id);
    return `/${locale}/admin/purchase-requests?${qs}`;
  };

  const pageHref = (nextPage: number) => {
    const qs = new URLSearchParams();
    if (tab !== "pending") qs.set("tab", tab);
    if (buildingId) qs.set("buildingId", buildingId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (nextPage) qs.set("page", String(nextPage));
    const q = qs.toString();
    return `/${locale}/admin/purchase-requests${q ? `?${q}` : ""}`;
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
        <div className="text-4xl mb-3">📋</div>
        <p className="font-semibold text-gray-900">
          {isEn ? "No purchase requests" : "لا توجد طلبات شراء"}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {tab === "pending"
            ? isEn
              ? "Nothing is waiting for your approval right now."
              : "لا يوجد شيء بانتظار اعتمادك حاليًا."
            : isEn
              ? "No requests match these filters."
              : "لا توجد طلبات تطابق هذه الفلاتر."}
        </p>
      </div>
    );
  }

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-start">
                <Th isEn={isEn} en="Number" ar="الرقم" />
                <Th isEn={isEn} en="Date" ar="التاريخ" />
                <Th isEn={isEn} en="Building" ar="المبنى" />
                <Th isEn={isEn} en="Requester" ar="مقدم الطلب" />
                <Th isEn={isEn} en="Priority" ar="الأولوية" />
                <Th isEn={isEn} en="Est. total" ar="الإجمالي التقديري" />
                <Th isEn={isEn} en="Items" ar="الأصناف" />
                <Th isEn={isEn} en="Status" ar="الحالة" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900 whitespace-nowrap">
                    {row.number || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDate(row.date, isEn)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.locationName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{row.requesterName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={PRIORITY_BADGE_STYLES[row.priority]}>
                      {priorityLabel(row.priority, isEn)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                    {formatOmr(row.estimatedTotal, isEn)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.itemCount}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_BADGE_STYLES[row.status]}>
                      {statusLabel(row.status, isEn)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={hrefFor(row)}
                      scroll={false}
                      className="text-nassayem font-semibold hover:underline whitespace-nowrap"
                    >
                      {row.status === "pending_supervisor"
                        ? isEn
                          ? "Review"
                          : "مراجعة"
                        : isEn
                          ? "View"
                          : "عرض"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={hrefFor(row)}
            scroll={false}
            className="block bg-white border border-gray-200 rounded-2xl p-4 hover:border-nassayem transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono font-bold text-gray-900">{row.number || "—"}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatDate(row.date, isEn)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={STATUS_BADGE_STYLES[row.status]}>
                  {statusLabel(row.status, isEn)}
                </Badge>
                {row.priority === "urgent" && (
                  <Badge className={PRIORITY_BADGE_STYLES.urgent}>
                    {priorityLabel("urgent", isEn)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Field label={isEn ? "Building" : "المبنى"} value={row.locationName ?? "—"} />
              <Field label={isEn ? "Requester" : "مقدم الطلب"} value={row.requesterName ?? "—"} />
              <Field
                label={isEn ? "Est. total" : "الإجمالي"}
                value={formatOmr(row.estimatedTotal, isEn)}
              />
              <Field label={isEn ? "Items" : "الأصناف"} value={String(row.itemCount)} />
            </div>
          </Link>
        ))}
      </div>

      {paginated && lastPage > 0 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm">
          <span className="text-gray-500">
            {isEn
              ? `Page ${page + 1} of ${lastPage + 1} · ${total} total`
              : `صفحة ${page + 1} من ${lastPage + 1} · ${total} إجمالاً`}
          </span>
          <div className="flex gap-2">
            {page > 0 && (
              <Link
                href={pageHref(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 font-semibold text-gray-600 hover:border-nassayem hover:text-nassayem"
              >
                {isEn ? "Previous" : "السابق"}
              </Link>
            )}
            {page < lastPage && (
              <Link
                href={pageHref(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 font-semibold text-gray-600 hover:border-nassayem hover:text-nassayem"
              >
                {isEn ? "Next" : "التالي"}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ isEn, en, ar }: { isEn: boolean; en: string; ar: string }) {
  return (
    <th className="px-4 py-3 text-start text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
      {isEn ? en : ar}
    </th>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-400 font-semibold">{label}</div>
      <div className="text-gray-800">{value}</div>
    </div>
  );
}
