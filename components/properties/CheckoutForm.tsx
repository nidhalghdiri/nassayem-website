"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/app/actions/booking";

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
};

export default function CheckoutForm({ unitId, checkIn, checkOut, locale }: CheckoutFormProps) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cash card */}
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
          {paymentMethod === "CARD" && (
            <p className="mt-4 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 leading-relaxed">
              {isEn
                ? "You will be redirected to Bank Muscat's secure payment page. Your booking is saved only after the payment succeeds."
                : "سيتم توجيهك إلى صفحة الدفع الآمنة لبنك مسقط. يتم حفظ حجزك فقط بعد نجاح الدفع."}
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
                  {isEn ? "Proceed to Payment" : "المتابعة للدفع"}
                </>
              )}
            </button>

            <p className="text-center text-gray-400 text-xs mt-4">
              {paymentMethod === "CASH"
                ? isEn
                  ? "Your booking will be confirmed immediately with no upfront payment required."
                  : "سيتم تأكيد حجزك فوراً دون الحاجة لدفع مسبق."
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
