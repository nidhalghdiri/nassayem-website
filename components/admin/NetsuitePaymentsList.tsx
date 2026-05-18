"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import type { NetsuitePayment } from "@prisma/client";
import VoidNetsuitePaymentButton from "@/components/admin/VoidNetsuitePaymentButton";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import PaymentDetailsModal from "@/components/admin/PaymentDetailsModal";
import {
  deactivateNetsuitePayment,
  reactivateNetsuitePayment,
} from "@/app/actions/netsuitePayment";

type Props = {
  payments: NetsuitePayment[];
  baseUrl: string;
  isEn: boolean;
  isManager: boolean;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  VOIDED: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  PAID: { en: "Paid", ar: "مدفوع" },
  FAILED: { en: "Failed", ar: "فشل" },
  EXPIRED: { en: "Expired", ar: "منتهٍ" },
  VOIDED: { en: "Voided", ar: "ملغى" },
};

function ManagerRowAction({
  payment,
  isEn,
}: {
  payment: NetsuitePayment;
  isEn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const onClick = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      try {
        if (payment.isActive) {
          await deactivateNetsuitePayment(payment.id);
        } else {
          await reactivateNetsuitePayment(payment.id);
        }
        router.refresh();
      } catch (err: any) {
        alert(err?.message || (isEn ? "Action failed" : "فشلت العملية"));
      }
    });
  };

  if (!payment.isActive) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
      >
        {isPending
          ? isEn
            ? "Restoring…"
            : "جارٍ الاسترجاع…"
          : isEn
            ? "Restore"
            : "استرجاع"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
        confirming
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
      } disabled:opacity-50`}
    >
      {isPending
        ? isEn
          ? "Deleting…"
          : "جارٍ الحذف…"
        : confirming
          ? isEn
            ? "Click to confirm"
            : "اضغط للتأكيد"
          : isEn
            ? "Delete"
            : "حذف"}
    </button>
  );
}

function ViewButton({
  onClick,
  isEn,
}: {
  onClick: () => void;
  isEn: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      {isEn ? "View" : "عرض"}
    </button>
  );
}

export default function NetsuitePaymentsList({
  payments,
  baseUrl,
  isEn,
  isManager,
}: Props) {
  const dateLocale = isEn ? enUS : ar;
  const [selected, setSelected] = useState<NetsuitePayment | null>(null);

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">
            {isEn ? "No payment links to show" : "لا توجد روابط دفع"}
          </h3>
          <p className="text-gray-500 text-sm max-w-xs">
            {isEn
              ? "When the receptionist creates a payment link from NetSuite, it will appear here."
              : "ستظهر روابط الدفع هنا عندما ينشئها موظف الاستقبال من NetSuite."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-4 font-semibold text-start">
                  {isEn ? "Reservation" : "الحجز"}
                </th>
                <th className="px-4 py-4 font-semibold text-start">
                  {isEn ? "Customer" : "العميل"}
                </th>
                <th className="px-4 py-4 font-semibold text-start">
                  {isEn ? "Amount" : "المبلغ"}
                </th>
                <th className="px-4 py-4 font-semibold text-start">
                  {isEn ? "Created" : "تاريخ الإنشاء"}
                </th>
                <th className="px-4 py-4 font-semibold text-start">
                  {isEn ? "Status" : "الحالة"}
                </th>
                <th className="px-4 py-4 font-semibold text-end">
                  {isEn ? "Actions" : "إجراءات"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => {
                const url = `${baseUrl}/${isEn ? "en" : "ar"}/pay/${p.token}`;
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-gray-50/50 ${p.isActive ? "" : "opacity-60"}`}
                  >
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs font-bold text-nassayem bg-nassayem/5 px-2 py-1 rounded-lg inline-block">
                        {p.netsuiteReservationRef ??
                          p.netsuiteReservationId.slice(0, 10)}
                      </div>
                      {p.unitCode && (
                        <div className="text-xs text-gray-400 mt-1">
                          {p.unitCode}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-gray-900 text-sm">
                        {p.customerName}
                      </div>
                      {p.customerEmail && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {p.customerEmail}
                        </div>
                      )}
                      {p.customerPhone && (
                        <div className="text-xs text-gray-400">
                          {p.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-extrabold text-gray-900">
                        {p.amount.toFixed(3)}
                      </span>
                      <span className="text-xs text-gray-400 ms-1">
                        {p.currency}
                      </span>
                      {p.smartpayBankRefNo && (
                        <div className="text-xs text-gray-400 font-mono mt-1">
                          {p.smartpayBankRefNo}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="text-gray-700 whitespace-nowrap">
                        {format(p.createdAt, "d MMM yyyy", {
                          locale: dateLocale,
                        })}
                      </div>
                      <div className="text-xs text-gray-400">
                        {format(p.createdAt, "HH:mm", {
                          locale: dateLocale,
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusStyles[p.status]}`}
                        >
                          {isEn
                            ? statusLabels[p.status]?.en
                            : statusLabels[p.status]?.ar}
                        </span>
                        {!p.isActive && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500 uppercase tracking-wider">
                            {isEn ? "Inactive" : "غير نشط"}
                          </span>
                        )}
                        {p.status === "PAID" && p.netsuiteSyncError && (
                          <div
                            className="text-xs text-red-600 mt-0.5"
                            title={p.netsuiteSyncError}
                          >
                            {isEn
                              ? "NetSuite sync failed"
                              : "فشل التزامن مع NetSuite"}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <ViewButton onClick={() => setSelected(p)} isEn={isEn} />
                        {p.status === "PENDING" && p.isActive && (
                          <>
                            <CopyLinkButton url={url} isEn={isEn} />
                            <VoidNetsuitePaymentButton
                              paymentId={p.id}
                              isEn={isEn}
                            />
                          </>
                        )}
                        {isManager && (
                          <ManagerRowAction payment={p} isEn={isEn} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-gray-100 lg:hidden">
          {payments.map((p) => {
            const url = `${baseUrl}/${isEn ? "en" : "ar"}/pay/${p.token}`;
            return (
              <div
                key={p.id}
                className={`p-4 space-y-3 ${p.isActive ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-nassayem bg-nassayem/5 px-2 py-1 rounded-lg">
                      {p.netsuiteReservationRef ??
                        p.netsuiteReservationId.slice(0, 10)}
                    </span>
                    <p className="font-bold text-gray-900 text-sm mt-1.5">
                      {p.customerName}
                    </p>
                    {p.unitCode && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.unitCode}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusStyles[p.status]}`}
                    >
                      {isEn
                        ? statusLabels[p.status]?.en
                        : statusLabels[p.status]?.ar}
                    </span>
                    {!p.isActive && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500 uppercase tracking-wider">
                        {isEn ? "Inactive" : "غير نشط"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {format(p.createdAt, "d MMM yyyy, HH:mm", {
                      locale: dateLocale,
                    })}
                  </span>
                  <span className="font-bold text-gray-900">
                    {p.amount.toFixed(3)}{" "}
                    <span className="font-normal text-gray-400">
                      {p.currency}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <ViewButton onClick={() => setSelected(p)} isEn={isEn} />
                  {p.status === "PENDING" && p.isActive && (
                    <>
                      <CopyLinkButton url={url} isEn={isEn} />
                      <VoidNetsuitePaymentButton
                        paymentId={p.id}
                        isEn={isEn}
                      />
                    </>
                  )}
                  {isManager && (
                    <ManagerRowAction payment={p} isEn={isEn} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PaymentDetailsModal
        payment={selected}
        isEn={isEn}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
