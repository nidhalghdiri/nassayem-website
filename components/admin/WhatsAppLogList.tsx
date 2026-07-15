"use client";

import Link from "next/link";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import type { WhatsAppMessageLog } from "@prisma/client";

type Recipient = { label: string; sub: string; conversationId?: string };

type Props = {
  messages: WhatsAppMessageLog[];
  /** Resolved identity per recipient number, keyed by the digits-only number. */
  recipients: Record<string, Recipient>;
  isEn: boolean;
  locale: string;
};

const statusStyles: Record<string, string> = {
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  SENT: { en: "Sent", ar: "مُرسل" },
  FAILED: { en: "Failed", ar: "فشل" },
  SKIPPED: { en: "Skipped", ar: "متخطى" },
};

const kindStyles: Record<string, string> = {
  template: "bg-nassayem/10 text-nassayem",
  text: "bg-blue-50 text-blue-600",
  image: "bg-purple-50 text-purple-600",
  location: "bg-amber-50 text-amber-700",
  contact: "bg-teal-50 text-teal-700",
};

const kindLabels: Record<string, { en: string; ar: string }> = {
  template: { en: "Template", ar: "قالب" },
  text: { en: "Text", ar: "نص" },
  image: { en: "Image", ar: "صورة" },
  location: { en: "Location", ar: "موقع" },
  contact: { en: "Contact", ar: "جهة اتصال" },
};

// Body-param labels for the templates we register. Index = param position, so
// the log can show "Building: X" instead of a bare list. Templates not listed
// here fall back to numbered params.
const templateParamLabels: Record<string, { en: string; ar: string }[]> = {
  ns_reception_reminder_en: [
    { en: "Building", ar: "المبنى" },
    { en: "Customer", ar: "العميل" },
    { en: "Phone", ar: "الهاتف" },
    { en: "Dates", ar: "التواريخ" },
    { en: "Persons", ar: "الأشخاص" },
    { en: "Summary", ar: "الملخص" },
  ],
  nassayem_task_assigned: [
    { en: "Name", ar: "الاسم" },
    { en: "Title", ar: "العنوان" },
    { en: "Building", ar: "المبنى" },
    { en: "Unit", ar: "الوحدة" },
  ],
};
templateParamLabels["ns_reception_reminder_ar"] = templateParamLabels["ns_reception_reminder_en"];
templateParamLabels["nassayem_task_assigned_ar"] = templateParamLabels["nassayem_task_assigned"];

export default function WhatsAppLogList({ messages, recipients, isEn, locale }: Props) {
  const dateLocale = isEn ? enUS : ar;

  if (messages.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <svg
          className="w-12 h-12 mx-auto text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-bold text-gray-900">
          {isEn ? "No messages found" : "لا توجد رسائل"}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {isEn
            ? "Nothing matches these filters. Only messages sent after the log was enabled appear here."
            : "لا يوجد ما يطابق عوامل التصفية. تظهر هنا الرسائل المُرسلة بعد تفعيل السجل فقط."}
        </p>
      </div>
    );
  }

  const renderDetail = (m: WhatsAppMessageLog) => {
    if (m.kind === "template") {
      const params = Array.isArray(m.bodyParams) ? (m.bodyParams as string[]) : [];
      const labels = m.templateName ? templateParamLabels[m.templateName] : undefined;
      return (
        <div className="space-y-0.5">
          {params.map((p, i) => (
            <div key={i} className="text-xs text-gray-600">
              <span className="text-gray-400">
                {labels?.[i] ? (isEn ? labels[i].en : labels[i].ar) : `{{${i + 1}}}`}:
              </span>{" "}
              <span className="text-gray-800">{p}</span>
            </div>
          ))}
        </div>
      );
    }
    if (m.kind === "image" && m.mediaUrl) {
      return (
        <div className="space-y-0.5">
          {m.body && <p className="text-xs text-gray-800">{m.body}</p>}
          <a
            href={m.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-nassayem hover:underline break-all"
          >
            {isEn ? "View image" : "عرض الصورة"}
          </a>
        </div>
      );
    }
    return <p className="text-xs text-gray-800 whitespace-pre-wrap">{m.body ?? "—"}</p>;
  };

  const recipientOf = (m: WhatsAppMessageLog) => recipients[m.to];

  const RecipientCell = ({ m }: { m: WhatsAppMessageLog }) => {
    const r = recipientOf(m);
    return (
      <>
        <p className="font-semibold text-gray-900 font-mono text-xs" dir="ltr">
          {m.to}
        </p>
        {r ? (
          <p className="text-xs text-gray-500 mt-0.5">
            {r.conversationId ? (
              <Link
                href={`/${locale}/admin/chatbot/conversations/${r.conversationId}`}
                className="text-nassayem hover:underline"
              >
                {r.label}
              </Link>
            ) : (
              r.label
            )}
            <span className="text-gray-400"> · {r.sub}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">{isEn ? "Unknown" : "غير معروف"}</p>
        )}
      </>
    );
  };

  const StatusPill = ({ m }: { m: WhatsAppMessageLog }) => (
    <span
      className={`px-2.5 py-1 text-xs font-bold rounded-full ${
        statusStyles[m.status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {statusLabels[m.status] ? (isEn ? statusLabels[m.status].en : statusLabels[m.status].ar) : m.status}
    </span>
  );

  const KindPill = ({ m }: { m: WhatsAppMessageLog }) => (
    <span
      className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
        kindStyles[m.kind] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {kindLabels[m.kind] ? (isEn ? kindLabels[m.kind].en : kindLabels[m.kind].ar) : m.kind}
    </span>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Desktop */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-4 font-semibold text-start">{isEn ? "Date / Time" : "التاريخ / الوقت"}</th>
              <th className="px-4 py-4 font-semibold text-start">{isEn ? "To" : "إلى"}</th>
              <th className="px-4 py-4 font-semibold text-start">{isEn ? "Type" : "النوع"}</th>
              <th className="px-4 py-4 font-semibold text-start">{isEn ? "Details" : "التفاصيل"}</th>
              <th className="px-4 py-4 font-semibold text-start">{isEn ? "Status" : "الحالة"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {messages.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50/50 align-top">
                <td className="px-4 py-4 whitespace-nowrap">
                  <p className="text-sm font-semibold text-gray-900">
                    {format(m.createdAt, "dd MMM yyyy", { locale: dateLocale })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5" dir="ltr">
                    {format(m.createdAt, "HH:mm:ss")}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <RecipientCell m={m} />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <KindPill m={m} />
                  {m.templateName && (
                    <p className="text-[11px] text-gray-500 mt-1 font-mono">{m.templateName}</p>
                  )}
                  {m.language && <p className="text-[11px] text-gray-400">{m.language}</p>}
                </td>
                <td className="px-4 py-4 max-w-md">{renderDetail(m)}</td>
                <td className="px-4 py-4">
                  <StatusPill m={m} />
                  {m.error && (
                    <details className="mt-1.5">
                      <summary className="text-[11px] text-red-600 cursor-pointer hover:underline">
                        {isEn ? "Error" : "الخطأ"}
                      </summary>
                      <pre className="mt-1 text-[10px] text-red-700 bg-red-50 rounded-lg p-2 max-w-xs overflow-x-auto whitespace-pre-wrap">
                        {m.error}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="divide-y divide-gray-100 lg:hidden">
        {messages.map((m) => (
          <div key={m.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <RecipientCell m={m} />
              </div>
              <StatusPill m={m} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <KindPill m={m} />
              {m.templateName && (
                <span className="text-[11px] text-gray-500 font-mono">{m.templateName}</span>
              )}
              <span className="text-xs text-gray-400" dir="ltr">
                {format(m.createdAt, "dd MMM yyyy HH:mm:ss", { locale: dateLocale })}
              </span>
            </div>
            {renderDetail(m)}
            {m.error && (
              <pre className="text-[10px] text-red-700 bg-red-50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                {m.error}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
