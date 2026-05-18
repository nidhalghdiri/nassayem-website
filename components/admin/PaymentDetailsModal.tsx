"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import type { NetsuitePayment } from "@prisma/client";

type Props = {
  payment: NetsuitePayment | null;
  isEn: boolean;
  onClose: () => void;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  PAID: "bg-emerald-100 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  EXPIRED: "bg-gray-100 text-gray-500 border-gray-200",
  VOIDED: "bg-gray-100 text-gray-500 border-gray-200",
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  PAID: { en: "Paid", ar: "مدفوع" },
  FAILED: { en: "Failed", ar: "فشل" },
  EXPIRED: { en: "Expired", ar: "منتهٍ" },
  VOIDED: { en: "Voided", ar: "ملغى" },
};

// SmartPay returns a URL-encoded query string (key=val&key=val&...), stored
// as-is in the JSON column. Parse it into ordered [key, value] pairs.
function parseSmartpayRaw(raw: unknown): [string, string][] | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    // Already-parsed JSON object: show as flat pairs.
    if (typeof raw === "object") {
      return Object.entries(raw as Record<string, unknown>).map(([k, v]) => [
        k,
        String(v),
      ]);
    }
    return null;
  }
  try {
    const params = new URLSearchParams(raw);
    const out: [string, string][] = [];
    params.forEach((v, k) => out.push([k, v]));
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function CopyButton({ text, isEn }: { text: string; isEn: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[10px] font-bold text-gray-400 hover:text-nassayem px-1.5 py-0.5 rounded transition-colors"
      title={isEn ? "Copy" : "نسخ"}
    >
      {copied ? (isEn ? "Copied!" : "تم النسخ!") : isEn ? "Copy" : "نسخ"}
    </button>
  );
}

function Field({
  label,
  value,
  mono = false,
  isEn,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  isEn: boolean;
}) {
  if (value == null || value === "") {
    return (
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-sm text-gray-300 italic">—</p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
          {label}
        </p>
        <CopyButton text={value} isEn={isEn} />
      </div>
      <p
        className={`text-sm text-gray-900 break-all ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-start hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-nassayem/10 text-nassayem flex items-center justify-center">
            {icon}
          </span>
          <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide">
            {title}
          </h3>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-50">{children}</div>
      )}
    </div>
  );
}

export default function PaymentDetailsModal({ payment, isEn, onClose }: Props) {
  const dateLocale = isEn ? enUS : ar;

  // Esc to close, lock body scroll while open.
  useEffect(() => {
    if (!payment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [payment, onClose]);

  if (!payment) return null;

  const rawPairs = parseSmartpayRaw(payment.smartpayRawResponse);
  const fmt = (d: Date | null | undefined) =>
    d ? format(d, "d MMM yyyy, HH:mm", { locale: dateLocale }) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-gray-50 w-full max-w-3xl rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-screen sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="bg-white border-b border-gray-100 px-5 sm:px-6 py-4 flex items-start gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${statusStyles[payment.status]}`}
              >
                {isEn
                  ? statusLabels[payment.status]?.en
                  : statusLabels[payment.status]?.ar}
              </span>
              {!payment.isActive && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border border-gray-300 bg-gray-100 text-gray-500">
                  {isEn ? "Inactive" : "غير نشط"}
                </span>
              )}
              <span className="font-mono text-xs font-bold text-nassayem bg-nassayem/5 px-2 py-0.5 rounded-md">
                {payment.netsuiteReservationRef ??
                  payment.netsuiteReservationId.slice(0, 10)}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 truncate">
              {payment.customerName}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {payment.amount.toFixed(3)}{" "}
              <span className="text-xs text-gray-400">{payment.currency}</span>
              {payment.description ? ` · ${payment.description}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={isEn ? "Close" : "إغلاق"}
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
                strokeWidth="2.5"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* NetSuite sync error banner */}
          {payment.status === "PAID" && payment.netsuiteSyncError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-bold text-red-700">
                  {isEn ? "NetSuite sync failed" : "فشل التزامن مع NetSuite"}
                </p>
                <p className="text-xs text-red-600 mt-0.5 break-all">
                  {payment.netsuiteSyncError}
                </p>
              </div>
            </div>
          )}

          {/* Summary */}
          <Section
            title={isEn ? "Summary" : "ملخص"}
            icon={
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 pt-3">
              <Field
                label={isEn ? "Amount" : "المبلغ"}
                value={`${payment.amount.toFixed(3)} ${payment.currency}`}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Created" : "تاريخ الإنشاء"}
                value={fmt(payment.createdAt)}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Updated" : "آخر تعديل"}
                value={fmt(payment.updatedAt)}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Expires" : "ينتهي"}
                value={fmt(payment.expiresAt)}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Paid At" : "تاريخ الدفع"}
                value={fmt(payment.paidAt)}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Synced to NetSuite" : "تم التزامن"}
                value={fmt(payment.netsuiteSyncedAt)}
                isEn={isEn}
              />
            </div>
          </Section>

          {/* Customer */}
          <Section
            title={isEn ? "Customer" : "العميل"}
            icon={
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 pt-3">
              <Field
                label={isEn ? "Name" : "الاسم"}
                value={payment.customerName}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Email" : "البريد الإلكتروني"}
                value={payment.customerEmail}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Phone" : "الهاتف"}
                value={payment.customerPhone}
                isEn={isEn}
              />
            </div>
          </Section>

          {/* NetSuite Reservation */}
          <Section
            title={isEn ? "NetSuite Reservation" : "حجز NetSuite"}
            icon={
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-3">
              <Field
                label={isEn ? "Reservation Ref" : "رقم الحجز"}
                value={payment.netsuiteReservationRef}
                mono
                isEn={isEn}
              />
              <Field
                label={isEn ? "Reservation ID" : "معرّف الحجز"}
                value={payment.netsuiteReservationId}
                mono
                isEn={isEn}
              />
              <Field
                label={isEn ? "Unit Code" : "كود الوحدة"}
                value={payment.unitCode}
                mono
                isEn={isEn}
              />
              <Field
                label={isEn ? "Check-In" : "تسجيل الدخول"}
                value={fmt(payment.checkIn)}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Check-Out" : "تسجيل الخروج"}
                value={fmt(payment.checkOut)}
                isEn={isEn}
              />
              <Field
                label={isEn ? "Description" : "الوصف"}
                value={payment.description}
                isEn={isEn}
              />
            </div>
          </Section>

          {/* Receptionist */}
          {(payment.receptionistName || payment.receptionistEmail) && (
            <Section
              title={isEn ? "Created By" : "أنشئ بواسطة"}
              icon={
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-3">
                <Field
                  label={isEn ? "Name" : "الاسم"}
                  value={payment.receptionistName}
                  isEn={isEn}
                />
                <Field
                  label={isEn ? "Email" : "البريد الإلكتروني"}
                  value={payment.receptionistEmail}
                  isEn={isEn}
                />
              </div>
            </Section>
          )}

          {/* SmartPay Transaction */}
          <Section
            title={isEn ? "SmartPay Transaction" : "معاملة SmartPay"}
            icon={
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
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-3 mb-4">
              <Field
                label={isEn ? "Order ID" : "رقم الطلب"}
                value={payment.smartpayOrderId}
                mono
                isEn={isEn}
              />
              <Field
                label={isEn ? "Bank Ref No" : "مرجع البنك"}
                value={payment.smartpayBankRefNo}
                mono
                isEn={isEn}
              />
            </div>

            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {isEn ? "Raw Response" : "الاستجابة الأصلية"}
            </p>
            {rawPairs ? (
              <div className="bg-gray-900 rounded-xl overflow-hidden">
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {rawPairs.map(([k, v], i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-800 last:border-0"
                        >
                          <td className="py-2 px-3 text-emerald-300 align-top whitespace-nowrap">
                            {k}
                          </td>
                          <td className="py-2 px-3 text-gray-100 break-all">
                            {v || (
                              <span className="text-gray-500 italic">empty</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                {isEn
                  ? "No SmartPay response recorded yet."
                  : "لا توجد استجابة من SmartPay بعد."}
              </p>
            )}
          </Section>

          {/* Identifiers */}
          <Section
            title={isEn ? "Identifiers" : "المعرّفات"}
            icon={
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            }
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-y-4 pt-3">
              <Field
                label={isEn ? "Payment ID" : "معرّف الدفع"}
                value={payment.id}
                mono
                isEn={isEn}
              />
              <Field
                label={isEn ? "Public Token" : "الرمز العام"}
                value={payment.token}
                mono
                isEn={isEn}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
