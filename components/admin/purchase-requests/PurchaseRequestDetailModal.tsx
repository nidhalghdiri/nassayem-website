"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  PurchaseRequestDetail,
  PurchaseRequestFailure,
} from "@/lib/netsuitePurchaseRequests";
import { PURCHASE_REQUEST_NOTE_MAX } from "@/lib/netsuitePurchaseRequests";
import {
  PRIORITY_BADGE_STYLES,
  STATUS_BADGE_STYLES,
  formatDate,
  formatDateTime,
  formatOmr,
  formatQuantity,
  priorityLabel,
  rejectStageLabel,
  statusLabel,
} from "@/lib/purchaseRequestFormat";
import { decidePurchaseRequestAction } from "@/app/actions/purchaseRequests";

/**
 * Purchase request detail drawer: header data, photo, item lines, approval
 * timeline, and the supervisor's approve/reject actions.
 *
 * The decision runs through a Server Action on an explicit button click — the
 * NetSuite `decide` endpoint is a GET that mutates, so it must never be
 * reachable from a render or a prefetch.
 */

type Props = {
  detail: PurchaseRequestDetail | null;
  failure: PurchaseRequestFailure | null;
  isEn: boolean;
  locale: string;
  canDecide: boolean;
  closeHref: string;
};

type DialogMode = "approve" | "reject" | null;

export default function PurchaseRequestDetailModal({
  detail,
  failure,
  isEn,
  locale,
  canDecide,
  closeHref,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isRtl = !isEn;

  const close = () => {
    startTransition(() => router.push(closeHref, { scroll: false }));
  };

  // Escape closes the drawer (or the inner dialog first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dialog) setDialog(null);
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close/dialog are stable enough for this handler's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  const submit = (decision: "approve" | "reject") => {
    if (!detail) return;
    setError(null);
    const trimmed = note.trim();
    if (decision === "reject" && !trimmed) {
      setError(isEn ? "A reason is required to reject." : "يجب إدخال سبب الرفض.");
      return;
    }
    startTransition(async () => {
      const result = await decidePurchaseRequestAction({
        id: detail.id,
        requestNumber: detail.number,
        decision,
        note: trimmed || undefined,
      });
      if (result.ok) {
        setDialog(null);
        setNote("");
        // Back to the list and refetch from NetSuite.
        router.push(closeHref, { scroll: false });
        router.refresh();
        return;
      }
      if (result.code === "STALE") {
        // Someone else decided in the meantime. Say so, then reload so the
        // supervisor sees the real current state rather than a stale form.
        setStale(true);
        setDialog(null);
        router.refresh();
        return;
      }
      setError(
        result.code === "UNREACHABLE"
          ? isEn
            ? "NetSuite could not be reached. The decision was not saved — try again."
            : "تعذر الوصول إلى NetSuite. لم يتم حفظ القرار — حاول مرة أخرى."
          : result.code === "FORBIDDEN"
            ? isEn
              ? "You are not allowed to decide on this request."
              : "غير مصرح لك باتخاذ قرار في هذا الطلب."
            : result.code === "NOT_FOUND"
              ? isEn
                ? "This request no longer exists in NetSuite."
                : "هذا الطلب غير موجود في NetSuite."
              : result.error,
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex" dir={isRtl ? "rtl" : "ltr"}>
      {/* Backdrop */}
      <button
        type="button"
        aria-label={isEn ? "Close" : "إغلاق"}
        onClick={close}
        className="absolute inset-0 bg-black/40"
      />

      {/* Drawer */}
      <div
        className={`relative ms-auto h-full w-full max-w-2xl bg-gray-50 shadow-2xl overflow-y-auto ${
          isRtl ? "font-arabic" : "font-english"
        }`}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between gap-3 z-10">
          <div>
            <div className="font-mono text-lg font-bold text-gray-900">
              {detail?.number || (isEn ? "Request" : "طلب")}
            </div>
            {detail && (
              <div className="text-xs text-gray-500 mt-0.5">
                {formatDate(detail.date, isEn)}
                {detail.locationName ? ` · ${detail.locationName}` : ""}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-2"
            aria-label={isEn ? "Close" : "إغلاق"}
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {stale && (
            <Notice tone="warn">
              {isEn
                ? "Someone has already acted on this request. The data below has been reloaded."
                : "قام شخص آخر باتخاذ قرار في هذا الطلب. تم إعادة تحميل البيانات أدناه."}
            </Notice>
          )}

          {failure && !detail && (
            <Notice tone="error">
              {failure.code === "NOT_FOUND"
                ? isEn
                  ? "This request was not found in NetSuite."
                  : "لم يتم العثور على هذا الطلب في NetSuite."
                : isEn
                  ? "NetSuite could not be reached, so the request could not be loaded."
                  : "تعذر الوصول إلى NetSuite، لذا لم يتم تحميل الطلب."}
              <div className="text-xs font-mono mt-1 opacity-70 break-all">
                {failure.code}: {failure.error}
              </div>
            </Notice>
          )}

          {detail && (
            <>
              {/* Status + priority */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_BADGE_STYLES[detail.status]
                  }`}
                >
                  {statusLabel(detail.status, isEn)}
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                    PRIORITY_BADGE_STYLES[detail.priority]
                  }`}
                >
                  {priorityLabel(detail.priority, isEn)}
                </span>
                {detail.tenantCharge && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border bg-purple-100 text-purple-700 border-purple-200">
                    {isEn ? "Chargeable to tenant" : "على حساب المستأجر"}
                  </span>
                )}
              </div>

              {/* Header data */}
              <Section title={isEn ? "Request details" : "تفاصيل الطلب"}>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Row label={isEn ? "Requester" : "مقدم الطلب"} value={detail.requesterName ?? "—"} />
                  <Row label={isEn ? "Building" : "المبنى"} value={detail.locationName ?? "—"} />
                  <Row
                    label={isEn ? "Estimated total" : "الإجمالي التقديري"}
                    value={formatOmr(detail.estimatedTotal, isEn)}
                  />
                  <Row label={isEn ? "Items" : "عدد الأصناف"} value={String(detail.itemCount)} />
                </dl>
                {detail.reason && (
                  <div className="mt-4">
                    <dt className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {isEn ? "Reason" : "السبب"}
                    </dt>
                    <dd className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">
                      {detail.reason}
                    </dd>
                  </div>
                )}
              </Section>

              {/* Photo, proxied through an authenticated route — the file is
                  private in NetSuite, so the browser never calls it directly. */}
              {detail.hasPhoto && (
                <Section title={isEn ? "Attachment" : "المرفق"}>
                  <Attachment id={detail.id} locale={locale} isEn={isEn} />
                </Section>
              )}

              {/* Items */}
              <Section title={isEn ? "Items" : "الأصناف"}>
                {detail.items.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {isEn ? "No item lines on this request." : "لا توجد أصناف في هذا الطلب."}
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-1 py-2 text-start text-xs font-bold text-gray-500 uppercase">
                            {isEn ? "Description" : "الوصف"}
                          </th>
                          <th className="px-1 py-2 text-end text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                            {isEn ? "Qty" : "الكمية"}
                          </th>
                          <th className="px-1 py-2 text-end text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                            {isEn ? "Unit price" : "سعر الوحدة"}
                          </th>
                          <th className="px-1 py-2 text-end text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                            {isEn ? "Total" : "الإجمالي"}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detail.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-1 py-2 text-gray-800">{item.description ?? "—"}</td>
                            <td className="px-1 py-2 text-end text-gray-700 whitespace-nowrap">
                              {formatQuantity(item.quantity)}
                            </td>
                            <td className="px-1 py-2 text-end text-gray-700 whitespace-nowrap">
                              {formatOmr(item.price, isEn)}
                            </td>
                            <td className="px-1 py-2 text-end font-semibold text-gray-900 whitespace-nowrap">
                              {formatOmr(item.total, isEn)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200">
                          <td colSpan={3} className="px-1 py-2 text-end font-bold text-gray-600">
                            {isEn ? "Estimated total" : "الإجمالي التقديري"}
                          </td>
                          <td className="px-1 py-2 text-end font-bold text-gray-900 whitespace-nowrap">
                            {formatOmr(detail.estimatedTotal, isEn)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Section>

              {/* Approval timeline */}
              <Section title={isEn ? "Approval timeline" : "مسار الاعتماد"}>
                <ol className="space-y-3">
                  <TimelineStep
                    isEn={isEn}
                    label={isEn ? "Supervisor" : "المشرف"}
                    stage={detail.supervisor}
                    pending={detail.status === "pending_supervisor"}
                  />
                  <TimelineStep
                    isEn={isEn}
                    label={isEn ? "Accounts" : "الحسابات"}
                    stage={detail.accounts}
                    pending={detail.status === "pending_accounts"}
                  />
                  <TimelineStep
                    isEn={isEn}
                    label={isEn ? "General Manager" : "المدير العام"}
                    stage={detail.gm}
                    pending={detail.status === "pending_gm"}
                  />
                </ol>

                {detail.status === "rejected" && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-bold text-red-700 uppercase tracking-wider">
                      {isEn ? "Rejected" : "مرفوض"}
                      {detail.rejectedStage
                        ? ` · ${rejectStageLabel(detail.rejectedStage, isEn)}`
                        : ""}
                    </div>
                    <p className="text-sm text-red-800 mt-1 whitespace-pre-wrap">
                      {detail.rejectReason ?? (isEn ? "No reason given." : "لم يُذكر سبب.")}
                    </p>
                  </div>
                )}
              </Section>

              {/* Actions */}
              {canDecide ? (
                <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-5 px-5 py-4 flex gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setNote("");
                      setError(null);
                      setDialog("approve");
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    {isEn ? "Approve" : "اعتماد"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setNote("");
                      setError(null);
                      setDialog("reject");
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {isEn ? "Reject" : "رفض"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-xl p-3">
                  {isEn
                    ? "This request is not at the supervisor stage, so it cannot be decided here."
                    : "هذا الطلب ليس في مرحلة المشرف، لذا لا يمكن اتخاذ قرار بشأنه هنا."}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Approve / reject dialog */}
      {dialog && detail && (
        <DecisionDialog
          mode={dialog}
          isEn={isEn}
          number={detail.number}
          note={note}
          setNote={setNote}
          error={error}
          isPending={isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => submit(dialog)}
        />
      )}
    </div>
  );
}

/** Approve (optional note) / reject (required reason) confirmation. */
function DecisionDialog({
  mode,
  isEn,
  number,
  note,
  setNote,
  error,
  isPending,
  onCancel,
  onConfirm,
}: {
  mode: "approve" | "reject";
  isEn: boolean;
  number: string;
  note: string;
  setNote: (v: string) => void;
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isApprove = mode === "approve";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={isEn ? "Cancel" : "إلغاء"}
        onClick={onCancel}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
        <h3 className="font-bold text-gray-900">
          {isApprove
            ? isEn
              ? `Approve ${number}?`
              : `اعتماد ${number}؟`
            : isEn
              ? `Reject ${number}?`
              : `رفض ${number}؟`}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {isApprove
            ? isEn
              ? "The request moves to Accounts for the next approval."
              : "سينتقل الطلب إلى الحسابات للاعتماد التالي."
            : isEn
              ? "The request is rejected and the chain stops here."
              : "سيتم رفض الطلب وتتوقف سلسلة الاعتماد هنا."}
        </p>

        <label className="block mt-4">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {isApprove
              ? isEn
                ? "Note (optional)"
                : "ملاحظة (اختياري)"
              : isEn
                ? "Reason (required)"
                : "السبب (مطلوب)"}
          </span>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, PURCHASE_REQUEST_NOTE_MAX))}
            rows={4}
            maxLength={PURCHASE_REQUEST_NOTE_MAX}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/30"
            placeholder={
              isApprove
                ? isEn
                  ? "Anything accounts should know…"
                  : "أي شيء يجب أن تعرفه الحسابات…"
                : isEn
                  ? "Why is this request rejected?"
                  : "ما سبب رفض هذا الطلب؟"
            }
          />
          <span className="text-[11px] text-gray-400">
            {note.length}/{PURCHASE_REQUEST_NOTE_MAX}
          </span>
        </label>

        {error && (
          <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-300 disabled:opacity-60"
          >
            {isEn ? "Cancel" : "إلغاء"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || (!isApprove && !note.trim())}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-60 ${
              isApprove ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isPending
              ? isEn
                ? "Saving…"
                : "جارٍ الحفظ…"
              : isApprove
                ? isEn
                  ? "Approve"
                  : "اعتماد"
                : isEn
                  ? "Reject"
                  : "رفض"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The attachment can be an image or a PDF, and which one is only known from
 * the proxy's Content-Type. Try to render it as an image; if that fails, fall
 * back to a link — which is also the right affordance for a PDF.
 */
function Attachment({ id, locale, isEn }: { id: string; locale: string; isEn: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/admin/purchase-requests/${encodeURIComponent(id)}/photo`;
  void locale;

  if (failed) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-nassayem hover:border-nassayem"
      >
        📄 {isEn ? "Open attachment" : "فتح المرفق"}
      </a>
    );
  }

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={isEn ? "Purchase request attachment" : "مرفق طلب الشراء"}
        onError={() => setFailed(true)}
        className="max-h-80 w-auto rounded-xl border border-gray-200 bg-white"
      />
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs font-semibold text-nassayem hover:underline"
      >
        {isEn ? "Open full size" : "عرض بالحجم الكامل"}
      </a>
    </div>
  );
}

function TimelineStep({
  isEn,
  label,
  stage,
  pending,
}: {
  isEn: boolean;
  label: string;
  stage: { name: string | null; date: string | null; note?: string | null } | null;
  pending: boolean;
}) {
  const done = !!stage;
  const when = formatDateTime(stage?.date, isEn);
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
          done
            ? "bg-emerald-100 text-emerald-700"
            : pending
              ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-400"
        }`}
      >
        {done ? "✓" : pending ? "•" : "–"}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        {done ? (
          <div className="text-xs text-gray-500">
            {stage?.name ?? "—"}
            {when ? ` · ${when}` : ""}
          </div>
        ) : (
          <div className="text-xs text-gray-400">
            {pending
              ? isEn
                ? "Waiting"
                : "بانتظار"
              : isEn
                ? "Not reached yet"
                : "لم يُصل بعد"}
          </div>
        )}
        {stage?.note && (
          <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{stage.note}</p>
        )}
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5">{value}</dd>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "warn" | "error";
  children: React.ReactNode;
}) {
  const styles =
    tone === "warn"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : "bg-red-50 border-red-200 text-red-800";
  return <div className={`border rounded-xl px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
