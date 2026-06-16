"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  advanceLaundryStatus,
  cancelLaundryOrder,
  addLaundryNote,
} from "@/app/actions/laundry";
import {
  LAUNDRY_STATUS_CONFIG,
  COUNT_STAGES,
  COUNT_FIELD_ORDER,
  type TLaundryStatus,
  type TLaundryCountField,
} from "@/lib/laundry/constants";
import {
  getForwardTransition,
  getItemLegs,
  isTerminalLaundryStatus,
  type ItemCounts,
} from "@/lib/laundry/workflow";
import { canAdvanceLaundry, canCancelLaundry } from "@/lib/laundry/permissions";
import {
  TASK_PRIORITY_CONFIG,
  STAFF_ROLE_CONFIG,
  type TStaffRole,
  type TTaskPriority,
} from "@/lib/tasks/constants";
import type { SerializedLaundryOrder, LaundryEventItem, Person } from "./types";

type Props = {
  order: SerializedLaundryOrder;
  events: LaundryEventItem[];
  locale: string;
  currentUserId: string;
  currentUserRole: string;
  isCreator: boolean;
};

type ToastData = { msg: string; type: "success" | "error" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
function personName(p: Person | null, fallback: string) {
  if (!p) return fallback;
  return p.name ?? p.email.split("@")[0];
}

export default function LaundryDetail({
  order,
  events,
  locale,
  currentUserId,
  currentUserRole,
  isCreator,
}: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const role = currentUserRole as TStaffRole;
  const status = order.status as TLaundryStatus;

  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const forward = getForwardTransition(status);
  const canAct = !!forward && canAdvanceLaundry(role, status);
  const canCancel = canCancelLaundry(role, status, isCreator);
  const terminal = isTerminalLaundryStatus(status);

  // ── Count-entry state (shown when the forward step captures counts) ─────────
  const [showCounts, setShowCounts] = useState(false);
  const prevField: TLaundryCountField | null = forward?.countField
    ? COUNT_FIELD_ORDER[COUNT_FIELD_ORDER.indexOf(forward.countField) - 1] ?? null
    : null;
  const [counts, setCounts] = useState<Record<string, string>>({});

  const initCounts = () => {
    const seed: Record<string, string> = {};
    for (const item of order.items) {
      const base = prevField ? (item[prevField] as number | null) : null;
      seed[item.id] = String(base ?? item.requestedQty);
    }
    setCounts(seed);
    setShowCounts(true);
  };

  const submitAdvance = (withCounts: boolean) => {
    if (!forward) return;
    let countsPayload: Record<string, number> | undefined;
    if (withCounts) {
      countsPayload = {};
      for (const item of order.items) {
        const v = parseInt(counts[item.id] ?? "", 10);
        if (!Number.isInteger(v) || v < 0) {
          showToast(isEn ? "Enter a valid count for every item." : "أدخل عدداً صحيحاً لكل صنف.", "error");
          return;
        }
        countsPayload[item.id] = v;
      }
    }
    startTransition(async () => {
      const res = await advanceLaundryStatus({
        orderId: order.id,
        toStatus: forward.to,
        counts: countsPayload,
        locale,
      });
      if (res.error) {
        showToast(res.error, "error");
      } else {
        setShowCounts(false);
        showToast(isEn ? "Updated." : "تم التحديث.");
        router.refresh();
      }
    });
  };

  // ── Cancel state ─────────────────────────────────────────────────────────────
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const submitCancel = () => {
    startTransition(async () => {
      const res = await cancelLaundryOrder({ orderId: order.id, reason: cancelReason, locale });
      if (res.error) showToast(res.error, "error");
      else {
        setShowCancel(false);
        showToast(isEn ? "Order cancelled." : "تم إلغاء الطلب.");
        router.refresh();
      }
    });
  };

  // ── Notes ──────────────────────────────────────────────────────────────────
  const [noteText, setNoteText] = useState("");
  const submitNote = () => {
    if (!noteText.trim()) return;
    startTransition(async () => {
      const res = await addLaundryNote({ orderId: order.id, text: noteText.trim(), locale });
      if (res.error) showToast(res.error, "error");
      else {
        setNoteText("");
        showToast(isEn ? "Note added." : "تمت إضافة الملاحظة.");
        router.refresh();
      }
    });
  };

  const statusConf = LAUNDRY_STATUS_CONFIG[status];
  const priorityConf = TASK_PRIORITY_CONFIG[order.priority as TTaskPriority];

  // Stepper definition: timestamp + responsible person per stage.
  const steps: { key: TLaundryStatus; at: string | null; person: Person | null }[] = [
    { key: "REQUESTED", at: order.createdAt, person: order.requestedBy },
    { key: "PICKED_UP", at: order.pickedUpAt, person: order.supervisor },
    { key: "AT_LAUNDRY", at: order.atLaundryAt, person: order.laundryUser },
    { key: "PROCESSING", at: order.processingAt, person: order.laundryUser },
    { key: "READY", at: order.readyAt, person: order.laundryUser },
    { key: "OUT_FOR_DELIVERY", at: order.outForDeliveryAt, person: order.supervisor },
    { key: "DELIVERED", at: order.deliveredAt, person: order.requestedBy },
  ];

  // Per-item set of count fields that show a shortfall, for cell highlighting.
  const itemLegMap = new Map<string, Set<TLaundryCountField>>();
  for (const item of order.items) {
    const itemCounts: ItemCounts = {
      requestedQty: item.requestedQty,
      pickedUpQty: item.pickedUpQty,
      atLaundryQty: item.atLaundryQty,
      returnedQty: item.returnedQty,
      deliveredQty: item.deliveredQty,
    };
    const bad = new Set<TLaundryCountField>();
    for (const leg of getItemLegs(itemCounts)) if (leg.delta > 0) bad.add(leg.field);
    itemLegMap.set(item.id, bad);
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusConf.badge}`}>
              {isEn ? statusConf.labelEn : statusConf.labelAr}
            </span>
            {priorityConf && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${priorityConf.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${priorityConf.dot}`} />
                {isEn ? priorityConf.labelEn : priorityConf.labelAr}
              </span>
            )}
            {order.hasDiscrepancy && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {order.totalMissing} {isEn ? "missing" : "مفقود"}
              </span>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <Meta label={isEn ? "Building" : "المبنى"} value={order.building ? (isEn ? order.building.nameEn : order.building.nameAr) : "—"} />
          <Meta label={isEn ? "Needed By" : "مطلوب بحلول"} value={formatDate(order.neededDate)} />
          <Meta label={isEn ? "Requested By" : "طلبه"} value={personName(order.requestedBy, "—")} />
          <Meta label={isEn ? "Total Pieces" : "إجمالي القطع"} value={String(order.totalRequested)} />
        </dl>

        {order.notes && (
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{isEn ? "Notes" : "ملاحظات"}</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
      </div>

      {/* ── Action panel ────────────────────────────────────────────────────── */}
      {(canAct || canCancel) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {isEn ? "Your Action" : "إجراؤك"}
          </h3>

          {canAct && forward && !showCounts && (
            <button
              onClick={() => (forward.countField ? initCounts() : submitAdvance(false))}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-nassayem text-white text-sm font-semibold rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {isEn ? forward.labelEn : forward.labelAr}
            </button>
          )}

          {/* Count entry */}
          {canAct && forward?.countField && showCounts && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/60">
              <p className="text-sm font-medium text-gray-700">
                {isEn ? "Count the pieces you are handling:" : "احسب القطع التي تتسلمها:"}
              </p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">{isEn ? item.nameEn : item.nameAr}</span>
                    <div className="flex items-center gap-2">
                      {prevField && (
                        <span className="text-xs text-gray-400">
                          / {(item[prevField] as number | null) ?? item.requestedQty}
                        </span>
                      )}
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={counts[item.id] ?? ""}
                        onChange={(e) => setCounts((c) => ({ ...c, [item.id]: e.target.value }))}
                        className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => submitAdvance(true)}
                  disabled={isPending}
                  className="px-5 py-2 bg-nassayem text-white text-sm font-semibold rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-60"
                >
                  {isEn ? "Confirm" : "تأكيد"}
                </button>
                <button
                  onClick={() => setShowCounts(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  {isEn ? "Cancel" : "إلغاء"}
                </button>
              </div>
            </div>
          )}

          {/* Cancel order */}
          {canCancel && !showCancel && (
            <button
              onClick={() => setShowCancel(true)}
              disabled={isPending}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              {isEn ? "Cancel this order" : "إلغاء هذا الطلب"}
            </button>
          )}
          {canCancel && showCancel && (
            <div className="border border-red-200 rounded-xl p-4 space-y-3 bg-red-50/50">
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder={isEn ? "Reason (optional)…" : "السبب (اختياري)…"}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={submitCancel}
                  disabled={isPending}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {isEn ? "Confirm Cancel" : "تأكيد الإلغاء"}
                </button>
                <button
                  onClick={() => setShowCancel(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  {isEn ? "Keep" : "إبقاء"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {terminal && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 italic">
          {status === "DELIVERED"
            ? (isEn ? "This order is complete." : "هذا الطلب مكتمل.")
            : (isEn ? "This order was cancelled." : "تم إلغاء هذا الطلب.")}
        </div>
      )}

      {/* ── Count table ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {isEn ? "Custody Counts" : "أعداد العهدة"}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-gray-400">
                <th className="text-start font-semibold py-2 pe-3">{isEn ? "Item" : "الصنف"}</th>
                {COUNT_STAGES.map((s) => (
                  <th key={s.field} className="text-center font-semibold px-2 py-2 whitespace-nowrap">
                    {isEn ? s.labelEn : s.labelAr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const bad = itemLegMap.get(item.id) ?? new Set();
                return (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="py-2.5 pe-3 font-medium text-gray-800">{isEn ? item.nameEn : item.nameAr}</td>
                    {COUNT_STAGES.map((s) => {
                      const val = item[s.field] as number | null;
                      const isBad = bad.has(s.field);
                      return (
                        <td key={s.field} className="text-center px-2 py-2.5">
                          {val === null ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span
                              className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-md font-semibold ${
                                isBad ? "bg-red-100 text-red-700" : "text-gray-700"
                              }`}
                            >
                              {val}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          {isEn
            ? "A red count means pieces went missing on that handoff."
            : "العدد بالأحمر يعني فقدان قطع في تلك المرحلة."}
        </p>
      </div>

      {/* ── Custody timeline (stepper) ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {isEn ? "Custody Chain" : "سلسلة العهدة"}
        </h3>
        <div>
          {steps.map((step, idx) => {
            const conf = LAUNDRY_STATUS_CONFIG[step.key];
            const done = !!step.at;
            const isLast = idx === steps.length - 1;
            return (
              <div key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-300"}`}>
                    {done ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </div>
                  {!isLast && <div className={`w-px flex-1 my-1 min-h-[20px] ${done ? "bg-green-200" : "bg-gray-200"}`} />}
                </div>
                <div className="pb-5 min-w-0">
                  <p className={`text-sm font-semibold ${done ? "text-gray-800" : "text-gray-400"}`}>
                    {isEn ? conf.labelEn : conf.labelAr}
                  </p>
                  {done && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {personName(step.person, "—")} · {formatDateTime(step.at!)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Activity & notes ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {isEn ? "Activity" : "النشاط"}
        </h3>
        <div>
          {events.map((ev, idx) => {
            const roleConf = ev.user.role ? STAFF_ROLE_CONFIG[ev.user.role as TStaffRole] : null;
            const isLast = idx === events.length - 1;
            const isWarning = ev.details.includes("⚠");
            return (
              <div key={ev.id} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${isWarning ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500"}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-gray-200 my-1 min-h-[16px]" />}
                </div>
                <div className="pb-5 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">
                    {personName(ev.user, ev.user.email)}
                    {roleConf && <span className="text-gray-400 font-normal ms-1.5">· {isEn ? roleConf.labelEn : roleConf.labelAr}</span>}
                  </p>
                  <p className={`text-xs mt-0.5 leading-relaxed ${isWarning ? "text-red-600" : "text-gray-500"}`}>{ev.details}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(ev.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add note */}
        <div className="space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            placeholder={isEn ? "Add a note…" : "أضف ملاحظة…"}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
          />
          {noteText.trim() && (
            <div className="flex justify-end">
              <button
                onClick={submitNote}
                disabled={isPending}
                className="px-4 py-1.5 bg-nassayem text-white text-xs font-semibold rounded-lg hover:bg-nassayem/90 transition-colors disabled:opacity-60"
              >
                {isEn ? "Add Note" : "إضافة ملاحظة"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}
