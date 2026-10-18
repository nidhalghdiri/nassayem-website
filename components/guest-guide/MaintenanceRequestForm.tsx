"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ISSUE_TYPES, type IssueKey } from "@/lib/guestGuide";
import { whatsappLink } from "@/lib/contact";

type BuildingOption = { id: string; nameEn: string; nameAr: string };

/**
 * Guest maintenance request. Builds a structured message and hands it to
 * WhatsApp so it reaches the team instantly — no account or app needed, and
 * no unauthenticated writes to our database.
 */
export default function MaintenanceRequestForm({
  locale,
  buildings,
}: {
  locale: string;
  buildings: BuildingOption[];
}) {
  const isEn = locale === "en";
  const [building, setBuilding] = useState("");
  const [apartment, setApartment] = useState("");
  const [issue, setIssue] = useState<IssueKey | null>(null);
  const [details, setDetails] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [tried, setTried] = useState(false);

  const missingApartment = !apartment.trim();
  const missingIssue = !issue;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (missingApartment || missingIssue) return;

    const issueLabel = ISSUE_TYPES.find((t) => t.key === issue)!.label;
    const b = buildings.find((x) => x.id === building);
    const lines = isEn
      ? [
          urgent ? "🔴 URGENT maintenance request" : "🛠️ Maintenance request",
          b ? `Building: ${b.nameEn}` : null,
          `Apartment: ${apartment.trim()}`,
          `Issue: ${issueLabel.en}`,
          details.trim() ? `Details: ${details.trim()}` : null,
        ]
      : [
          urgent ? "🔴 طلب صيانة عاجل" : "🛠️ طلب صيانة",
          b ? `المبنى: ${b.nameAr}` : null,
          `رقم الشقة: ${apartment.trim()}`,
          `نوع المشكلة: ${issueLabel.ar}`,
          details.trim() ? `التفاصيل: ${details.trim()}` : null,
        ];

    window.open(whatsappLink(lines.filter(Boolean).join("\n")), "_blank", "noopener,noreferrer");
  }

  const inputCls =
    "w-full rounded-xl border bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem transition";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {buildings.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">{isEn ? "Building" : "المبنى"}</span>
            <select value={building} onChange={(e) => setBuilding(e.target.value)} className={`${inputCls} border-gray-200`}>
              <option value="">{isEn ? "Select your building" : "اختر المبنى"}</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {isEn ? b.nameEn : b.nameAr}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            {isEn ? "Apartment number" : "رقم الشقة"} <span className="text-red-500">*</span>
          </span>
          <input
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            inputMode="text"
            placeholder={isEn ? "e.g. 204" : "مثال: 204"}
            aria-invalid={tried && missingApartment}
            className={`${inputCls} ${tried && missingApartment ? "border-red-300" : "border-gray-200"}`}
          />
          {tried && missingApartment && (
            <span className="mt-1 block text-xs text-red-600">{isEn ? "Please enter your apartment number." : "يرجى إدخال رقم الشقة."}</span>
          )}
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700">
          {isEn ? "What needs fixing?" : "ما المشكلة؟"} <span className="text-red-500">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {ISSUE_TYPES.map((t) => {
            const selected = issue === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setIssue(t.key)}
                aria-pressed={selected}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selected
                    ? "border-nassayem bg-nassayem text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-nassayem/50"
                }`}
              >
                {isEn ? t.label.en : t.label.ar}
              </button>
            );
          })}
        </div>
        {tried && missingIssue && (
          <span className="mt-2 block text-xs text-red-600">{isEn ? "Please choose the type of issue." : "يرجى اختيار نوع المشكلة."}</span>
        )}
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-gray-700">
          {isEn ? "Details" : "التفاصيل"} <span className="font-normal text-gray-400">{isEn ? "(optional)" : "(اختياري)"}</span>
        </span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder={isEn ? "Describe the problem briefly…" : "صف المشكلة باختصار…"}
          className={`${inputCls} border-gray-200 resize-none`}
        />
      </label>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <input
          type="checkbox"
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
        />
        <span className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{isEn ? "This is urgent" : "الأمر عاجل"}</span>
          {" — "}
          {isEn ? "e.g. water leak, no power, locked out" : "مثل تسرب ماء، انقطاع كهرباء، أو عدم القدرة على الدخول"}
        </span>
      </label>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-4 text-base font-bold text-white shadow-sm transition hover:brightness-95 active:scale-[0.99]"
      >
        <Send className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
        {isEn ? "Send request via WhatsApp" : "أرسل الطلب عبر واتساب"}
      </button>
      <p className="text-center text-xs text-gray-500">
        {isEn
          ? "Opens WhatsApp with your request ready to send. Our team will reply shortly."
          : "سيفتح واتساب برسالة جاهزة للإرسال، وسيتواصل معك فريقنا قريباً."}
      </p>
    </form>
  );
}
