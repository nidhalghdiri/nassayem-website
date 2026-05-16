"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/app/actions/booking";

// Returns true when any night in [checkIn, checkOut) lands in July or August.
// `checkOut` is the morning of departure, so it's exclusive.
function stayTouchesKhareef(checkIn: string, checkOut: string): boolean {
  const [sy, sm, sd] = checkIn.split("-").map(Number);
  const [ey, em, ed] = checkOut.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const cursor = new Date(start);
  while (cursor < end) {
    const m = cursor.getUTCMonth();
    if (m === 6 || m === 7) return true;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return false;
}

// ── Country data (GCC first, then broader region, then global) ─────────────────
const COUNTRIES = [
  { code: "OM", nameEn: "Oman",             nameAr: "عُمان",            dialCode: "+968" },
  { code: "SA", nameEn: "Saudi Arabia",     nameAr: "السعودية",          dialCode: "+966" },
  { code: "AE", nameEn: "UAE",              nameAr: "الإمارات",          dialCode: "+971" },
  { code: "KW", nameEn: "Kuwait",           nameAr: "الكويت",            dialCode: "+965" },
  { code: "BH", nameEn: "Bahrain",          nameAr: "البحرين",           dialCode: "+973" },
  { code: "QA", nameEn: "Qatar",            nameAr: "قطر",               dialCode: "+974" },
  { code: "YE", nameEn: "Yemen",            nameAr: "اليمن",             dialCode: "+967" },
  { code: "JO", nameEn: "Jordan",           nameAr: "الأردن",            dialCode: "+962" },
  { code: "EG", nameEn: "Egypt",            nameAr: "مصر",               dialCode: "+20"  },
  { code: "IQ", nameEn: "Iraq",             nameAr: "العراق",            dialCode: "+964" },
  { code: "SY", nameEn: "Syria",            nameAr: "سوريا",             dialCode: "+963" },
  { code: "LB", nameEn: "Lebanon",          nameAr: "لبنان",             dialCode: "+961" },
  { code: "MA", nameEn: "Morocco",          nameAr: "المغرب",            dialCode: "+212" },
  { code: "TN", nameEn: "Tunisia",          nameAr: "تونس",              dialCode: "+216" },
  { code: "DZ", nameEn: "Algeria",          nameAr: "الجزائر",           dialCode: "+213" },
  { code: "PK", nameEn: "Pakistan",         nameAr: "باكستان",           dialCode: "+92"  },
  { code: "IN", nameEn: "India",            nameAr: "الهند",             dialCode: "+91"  },
  { code: "BD", nameEn: "Bangladesh",       nameAr: "بنغلاديش",          dialCode: "+880" },
  { code: "PH", nameEn: "Philippines",      nameAr: "الفلبين",           dialCode: "+63"  },
  { code: "LK", nameEn: "Sri Lanka",        nameAr: "سريلانكا",          dialCode: "+94"  },
  { code: "NP", nameEn: "Nepal",            nameAr: "نيبال",             dialCode: "+977" },
  { code: "GB", nameEn: "United Kingdom",   nameAr: "المملكة المتحدة",   dialCode: "+44"  },
  { code: "US", nameEn: "United States",    nameAr: "الولايات المتحدة",  dialCode: "+1"   },
  { code: "DE", nameEn: "Germany",          nameAr: "ألمانيا",           dialCode: "+49"  },
  { code: "FR", nameEn: "France",           nameAr: "فرنسا",             dialCode: "+33"  },
  { code: "IT", nameEn: "Italy",            nameAr: "إيطاليا",           dialCode: "+39"  },
  { code: "CN", nameEn: "China",            nameAr: "الصين",             dialCode: "+86"  },
  { code: "JP", nameEn: "Japan",            nameAr: "اليابان",           dialCode: "+81"  },
  { code: "TR", nameEn: "Turkey",           nameAr: "تركيا",             dialCode: "+90"  },
  { code: "NG", nameEn: "Nigeria",          nameAr: "نيجيريا",           dialCode: "+234" },
  { code: "KE", nameEn: "Kenya",            nameAr: "كينيا",             dialCode: "+254" },
  { code: "TZ", nameEn: "Tanzania",         nameAr: "تنزانيا",           dialCode: "+255" },
  { code: "ET", nameEn: "Ethiopia",         nameAr: "إثيوبيا",           dialCode: "+251" },
  { code: "OTHER", nameEn: "Other",         nameAr: "أخرى",              dialCode: ""     },
];

type CheckoutFormProps = {
  unitId: string;
  checkIn: string;
  checkOut: string;
  locale: string;
  totalPrice: number;
};

// Mirrors the server-side policy in app/actions/booking.ts.
const ADVANCE_PAYMENT_MIN_TOTAL_OMR = 30;
const ADVANCE_PAYMENT_RATIO = 0.5;

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export default function CheckoutForm({
  unitId,
  checkIn,
  checkOut,
  locale,
  totalPrice,
}: CheckoutFormProps) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Khareef season (July/August) forces online payment.
  const isKhareef = stayTouchesKhareef(checkIn, checkOut);

  // Advance payment is offered only for Khareef bookings with total > 30 OMR.
  const advanceEligible = isKhareef && totalPrice > ADVANCE_PAYMENT_MIN_TOTAL_OMR;
  const advanceAmount = round3(totalPrice * ADVANCE_PAYMENT_RATIO);
  const remainingAmount = round3(totalPrice - advanceAmount);

  // Payment method — Khareef stays must pay online.
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">(
    isKhareef ? "CARD" : "CASH",
  );
  // Payment plan — default to ADVANCE_50 when eligible to encourage bookings.
  const [paymentPlan, setPaymentPlan] = useState<"FULL" | "ADVANCE_50">(
    advanceEligible ? "ADVANCE_50" : "FULL",
  );

  // Nationality & phone
  const [nationalityCode, setNationalityCode] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // SmartPay redirect data
  const [paymentData, setPaymentData] = useState<{
    url: string;
    accessCode: string;
    encRequest: string;
  } | null>(null);

  const handleNationalityChange = (code: string) => {
    setNationalityCode(code);
    const country = COUNTRIES.find((c) => c.code === code);
    if (country && country.dialCode) {
      setPhonePrefix(country.dialCode);
      // Only auto-fill prefix if phone is empty or was previously a pure prefix
      setPhoneNumber((prev) => {
        if (!prev || COUNTRIES.some((c) => prev === c.dialCode)) return "";
        return prev;
      });
    }
  };

  const fullPhone = phonePrefix ? `${phonePrefix}${phoneNumber}` : phoneNumber;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rawForm = new FormData(e.currentTarget);
    // Override phone with the combined value
    rawForm.set("guestPhone", fullPhone);
    rawForm.set("paymentMethod", paymentMethod);
    rawForm.set(
      "paymentPlan",
      paymentMethod === "CARD" && advanceEligible ? paymentPlan : "FULL",
    );
    setError(null);

    startTransition(async () => {
      try {
        const result = await createBooking(rawForm, unitId, checkIn, checkOut, locale);

        if (result.success) {
          if (result.isCash) {
            // Cash: booking confirmed immediately — go straight to success
            router.push(`/${locale}/checkout/success?bookingId=${result.bookingId}`);
          } else {
            // Card: route through SmartPay
            setPaymentData({
              url: result.paymentUrl!,
              accessCode: result.accessCode!,
              encRequest: result.encRequest!,
            });
            setTimeout(() => {
              const form = document.getElementById("smartpay-form") as HTMLFormElement | null;
              form?.submit();
            }, 100);
          }
        }
      } catch (err: any) {
        setError(err.message || (isEn ? "An error occurred." : "حدث خطأ ما."));
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 mt-8">

        {/* ── Payment Method ─────────────────────────────────────────────── */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-5">
            {isEn ? "Payment Method" : "طريقة الدفع"}
          </h2>

          {isKhareef && (
            <p className="mb-5 text-xs text-nassayem bg-nassayem/5 border border-nassayem/20 rounded-xl px-4 py-3 leading-relaxed">
              {isEn
                ? "During Khareef season (July–August), online payment is required to confirm your booking."
                : "خلال موسم الخريف (يوليو–أغسطس)، الدفع الإلكتروني مطلوب لتأكيد حجزك."}
            </p>
          )}

          <div
            className={`grid gap-4 ${
              isKhareef ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
            }`}
          >
            {/* Cash card — hidden during Khareef season */}
            {!isKhareef && (
            <button
              type="button"
              onClick={() => setPaymentMethod("CASH")}
              className={`relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-start transition-all ${
                paymentMethod === "CASH"
                  ? "border-nassayem bg-nassayem/5 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              {/* Selected indicator */}
              <span
                className={`absolute top-4 end-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  paymentMethod === "CASH"
                    ? "border-nassayem bg-nassayem"
                    : "border-gray-300"
                }`}
              >
                {paymentMethod === "CASH" && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>

              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                paymentMethod === "CASH" ? "bg-nassayem text-white" : "bg-gray-100 text-gray-500"
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>

              <div>
                <p className="font-bold text-gray-900 text-sm">
                  {isEn ? "Pay at Reception" : "الدفع عند الاستقبال"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {isEn ? "Pay in cash when you check in." : "ادفع نقداً عند وصولك."}
                </p>
              </div>

              {paymentMethod === "CASH" && (
                <span className="text-xs font-bold text-nassayem bg-nassayem/10 px-2 py-0.5 rounded-full">
                  {isEn ? "Selected" : "محدد"}
                </span>
              )}
            </button>
            )}

            {/* Card payment */}
            <button
              type="button"
              onClick={() => setPaymentMethod("CARD")}
              className={`relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-start transition-all ${
                paymentMethod === "CARD"
                  ? "border-nassayem bg-nassayem/5 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              {/* Selected indicator */}
              <span
                className={`absolute top-4 end-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  paymentMethod === "CARD"
                    ? "border-nassayem bg-nassayem"
                    : "border-gray-300"
                }`}
              >
                {paymentMethod === "CARD" && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>

              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                paymentMethod === "CARD" ? "bg-nassayem text-white" : "bg-gray-100 text-gray-500"
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>

              <div>
                <p className="font-bold text-gray-900 text-sm">
                  {isEn ? "Online Payment" : "الدفع الإلكتروني"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {isEn ? "Secure payment via Bank Muscat SmartPay." : "دفع آمن عبر SmartPay بنك مسقط."}
                </p>
              </div>

              {paymentMethod === "CARD" && (
                <span className="text-xs font-bold text-nassayem bg-nassayem/10 px-2 py-0.5 rounded-full">
                  {isEn ? "Selected" : "محدد"}
                </span>
              )}
            </button>
          </div>

          {paymentMethod === "CASH" && (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 leading-relaxed">
              {isEn
                ? "Your booking will be confirmed immediately. Please bring the exact amount in cash upon arrival."
                : "سيتم تأكيد حجزك فوراً. يرجى إحضار المبلغ نقداً عند وصولك."}
            </p>
          )}

          {/* Advance-payment selector — Khareef only, total > 30 OMR. */}
          {paymentMethod === "CARD" && advanceEligible && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide">
                  {isEn ? "Choose your payment plan" : "اختر خطة الدفع"}
                </h3>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 uppercase tracking-wider">
                  {isEn ? "New" : "جديد"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 50% advance — recommended */}
                <button
                  type="button"
                  onClick={() => setPaymentPlan("ADVANCE_50")}
                  className={`relative flex flex-col gap-2 p-5 rounded-xl border-2 text-start transition-all ${
                    paymentPlan === "ADVANCE_50"
                      ? "border-nassayem bg-nassayem/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <span className="absolute -top-3 start-4 text-[10px] font-bold text-white bg-emerald-600 rounded-full px-3 py-1 uppercase tracking-wider shadow-sm">
                    {isEn ? "Most popular" : "الأكثر اختياراً"}
                  </span>
                  <span
                    className={`absolute top-4 end-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      paymentPlan === "ADVANCE_50"
                        ? "border-nassayem bg-nassayem"
                        : "border-gray-300"
                    }`}
                  >
                    {paymentPlan === "ADVANCE_50" && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>

                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">
                    {isEn ? "Pay 50% Today" : "ادفع 50% اليوم"}
                  </p>
                  <p className="text-2xl font-extrabold text-gray-900" dir="ltr">
                    {advanceAmount.toFixed(3)}{" "}
                    <span className="text-sm font-bold text-gray-500">
                      {isEn ? "OMR" : "ر.ع"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {isEn
                      ? `Pay the remaining ${remainingAmount.toFixed(3)} OMR at check-in.`
                      : `ادفع المبلغ المتبقي ${remainingAmount.toFixed(3)} ر.ع عند الوصول.`}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-700 mt-1">
                    {isEn
                      ? "Lock in your dates — easy on your wallet."
                      : "احجز تواريخك الآن — مريح لميزانيتك."}
                  </p>
                </button>

                {/* Full payment */}
                <button
                  type="button"
                  onClick={() => setPaymentPlan("FULL")}
                  className={`relative flex flex-col gap-2 p-5 rounded-xl border-2 text-start transition-all ${
                    paymentPlan === "FULL"
                      ? "border-nassayem bg-nassayem/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <span
                    className={`absolute top-4 end-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      paymentPlan === "FULL"
                        ? "border-nassayem bg-nassayem"
                        : "border-gray-300"
                    }`}
                  >
                    {paymentPlan === "FULL" && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>

                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">
                    {isEn ? "Pay Full Amount" : "ادفع المبلغ كاملاً"}
                  </p>
                  <p className="text-2xl font-extrabold text-gray-900" dir="ltr">
                    {totalPrice.toFixed(3)}{" "}
                    <span className="text-sm font-bold text-gray-500">
                      {isEn ? "OMR" : "ر.ع"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {isEn
                      ? "Nothing to pay at check-in."
                      : "لا يوجد دفع عند الوصول."}
                  </p>
                  <p className="text-[11px] font-bold text-nassayem mt-1">
                    {isEn
                      ? "Skip the queue at check-in."
                      : "تجاوز طابور الاستقبال."}
                  </p>
                </button>
              </div>

              {/* Cost breakdown */}
              <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">
                    {isEn ? "Pay today" : "ادفع اليوم"}
                  </span>
                  <span className="font-bold text-gray-900" dir="ltr">
                    {(paymentPlan === "ADVANCE_50" ? advanceAmount : totalPrice).toFixed(3)}{" "}
                    {isEn ? "OMR" : "ر.ع"}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">
                    {isEn ? "Due at check-in" : "مستحق عند الوصول"}
                  </span>
                  <span className="font-bold text-gray-900" dir="ltr">
                    {(paymentPlan === "ADVANCE_50" ? remainingAmount : 0).toFixed(3)}{" "}
                    {isEn ? "OMR" : "ر.ع"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900">
                    {isEn ? "Total stay" : "إجمالي الإقامة"}
                  </span>
                  <span className="font-extrabold text-gray-900" dir="ltr">
                    {totalPrice.toFixed(3)} {isEn ? "OMR" : "ر.ع"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {paymentMethod === "CARD" && (
            <p className="mt-4 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 leading-relaxed flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" clipRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
              </svg>
              <span>
                {isEn
                  ? "Secure payment via Bank Muscat SmartPay. Your booking is confirmed only after the payment succeeds."
                  : "دفع آمن عبر SmartPay بنك مسقط. يتم تأكيد حجزك فقط بعد نجاح الدفع."}
              </span>
            </p>
          )}
        </div>

        {/* ── Guest Details ──────────────────────────────────────────────── */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-5">
            {isEn ? "Guest Details" : "تفاصيل الضيف"}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 font-medium text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {isEn ? "Full Name" : "الاسم الكامل"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="guestName"
                required
                placeholder={isEn ? "e.g. Ahmed Salim" : "مثال: أحمد سالم"}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
              />
            </div>

            {/* Nationality */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {isEn ? "Nationality" : "الجنسية"}
              </label>
              <div className="relative">
                <select
                  name="guestNationality"
                  value={nationalityCode}
                  onChange={(e) => handleNationalityChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all appearance-none cursor-pointer"
                >
                  <option value="">
                    {isEn ? "Select nationality..." : "اختر الجنسية..."}
                  </option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {isEn ? c.nameEn : c.nameAr}
                      {c.dialCode ? ` (${c.dialCode})` : ""}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 end-4 flex items-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {isEn ? "Email Address" : "البريد الإلكتروني"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="guestEmail"
                  required
                  placeholder="email@example.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {isEn ? "Phone Number" : "رقم الهاتف"} <span className="text-red-500">*</span>
                </label>
                {/* Phone with prefix */}
                <div className="flex rounded-xl overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-nassayem/50 focus-within:border-nassayem transition-all bg-gray-50">
                  {phonePrefix && (
                    <span className="flex items-center px-3 py-3 bg-nassayem/10 text-nassayem font-bold text-sm border-e border-gray-200 whitespace-nowrap shrink-0">
                      {phonePrefix}
                    </span>
                  )}
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    placeholder={phonePrefix ? "99551237" : "+968 99551237"}
                    className="flex-1 bg-transparent px-3 py-3 text-gray-900 focus:outline-none text-sm min-w-0"
                    dir="ltr"
                  />
                </div>
                {nationalityCode && (
                  <p className="text-xs text-gray-400 mt-1">
                    {isEn ? "Country code auto-filled from nationality" : "تم تعبئة رمز الدولة تلقائياً"}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {isEn ? "Special Requests or Questions" : "طلبات خاصة أو أسئلة"}
                <span className="ms-2 text-xs font-normal text-gray-400">
                  ({isEn ? "optional" : "اختياري"})
                </span>
              </label>
              <textarea
                name="guestNotes"
                rows={3}
                placeholder={
                  isEn
                    ? "e.g. early check-in, extra towels, dietary needs..."
                    : "مثال: تسجيل دخول مبكر، مناشف إضافية، احتياجات غذائية..."
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all resize-none text-sm"
              />
            </div>
          </div>

          {/* Hidden inputs for combined phone and payment method */}
          <input type="hidden" name="guestPhone" value={fullPhone} />
          <input type="hidden" name="paymentMethod" value={paymentMethod} />
          <input
            type="hidden"
            name="paymentPlan"
            value={paymentMethod === "CARD" && advanceEligible ? paymentPlan : "FULL"}
          />

          <div className="mt-8 pt-6 border-t border-gray-100">
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-nassayem text-white py-4 rounded-xl font-bold text-lg hover:bg-nassayem-dark transition-colors flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isEn ? "Processing..." : "جارٍ المعالجة..."}
                </>
              ) : paymentMethod === "CASH" ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isEn ? "Confirm Booking" : "تأكيد الحجز"}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  {(() => {
                    const chargeNow =
                      paymentMethod === "CARD" && advanceEligible && paymentPlan === "ADVANCE_50"
                        ? advanceAmount
                        : totalPrice;
                    return isEn
                      ? `Pay ${chargeNow.toFixed(3)} OMR Now`
                      : `ادفع ${chargeNow.toFixed(3)} ر.ع الآن`;
                  })()}
                </>
              )}
            </button>

            <p className="text-center text-gray-400 text-xs mt-4">
              {paymentMethod === "CASH"
                ? isEn
                  ? "Your booking will be confirmed immediately with no upfront payment required."
                  : "سيتم تأكيد حجزك فوراً دون الحاجة لدفع مسبق."
                : paymentMethod === "CARD" && advanceEligible && paymentPlan === "ADVANCE_50"
                  ? isEn
                    ? `You'll be redirected to Bank Muscat to pay ${advanceAmount.toFixed(3)} OMR. Pay the remaining ${remainingAmount.toFixed(3)} OMR at check-in.`
                    : `سيتم توجيهك إلى بنك مسقط لدفع ${advanceAmount.toFixed(3)} ر.ع. المبلغ المتبقي ${remainingAmount.toFixed(3)} ر.ع يُدفع عند الوصول.`
                  : isEn
                    ? "You will be redirected to Bank Muscat's secure payment page."
                    : "سيتم توجيهك إلى صفحة الدفع الآمنة لبنك مسقط."}
            </p>
          </div>
        </div>
      </form>

      {/* Hidden SmartPay form — only rendered for CARD payments */}
      {paymentData && (
        <form id="smartpay-form" method="POST" action={paymentData.url} className="hidden">
          <input type="hidden" name="access_code" value={paymentData.accessCode} />
          <input type="hidden" name="encRequest" value={paymentData.encRequest} />
        </form>
      )}
    </>
  );
}
