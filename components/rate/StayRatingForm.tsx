"use client";

import { useState } from "react";

type Props = {
  token: string;
  locale: "ar" | "en";
  alreadySubmitted: boolean;
};

const CRITERIA = [
  { key: "cleanliness", ar: "نظافة الشقة", en: "Apartment cleanliness" },
  { key: "reception", ar: "تعامل الاستقبال", en: "Reception service" },
  { key: "facilities", ar: "الشقة والتجهيزات", en: "Apartment & facilities" },
  { key: "value", ar: "القيمة مقابل السعر", en: "Value for money" },
] as const;
type Key = (typeof CRITERIA)[number]["key"];

const COMMENT_MAX = 1000;

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10 transition-colors" aria-hidden>
      <path
        d="M12 2.5l2.94 6.1 6.56.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6-4.8-4.6 6.56-.9L12 2.5z"
        fill={filled ? "#f5b301" : "#d3e0de"}
      />
    </svg>
  );
}

export default function StayRatingForm({ token, locale, alreadySubmitted }: Props) {
  const isEn = locale === "en";
  const [ratings, setRatings] = useState<Partial<Record<Key, number>>>({});
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadySubmitted);

  const complete = CRITERIA.every((c) => ratings[c.key]) && recommend !== null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rate/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ratings, wouldRecommend: recommend, comment: comment.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok || body.error === "already-submitted") {
        setDone(true);
      } else {
        setError(
          isEn
            ? "Something went wrong. Please try again."
            : "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
        );
      }
    } catch {
      setError(
        isEn
          ? "No connection. Please check your internet and try again."
          : "لا يوجد اتصال. يرجى التحقق من الإنترنت والمحاولة مرة أخرى.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="px-6 py-14 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-extrabold text-gray-900">
          {isEn ? "Thank you!" : "شكراً لك!"}
        </h2>
        <p className="leading-relaxed text-gray-500">
          {isEn
            ? "Your feedback helps us improve. We hope to host you again soon."
            : "رأيك يساعدنا نتحسن. نتمنى نستضيفك مرة ثانية قريباً."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="px-6 py-4">
      {CRITERIA.map((c) => (
        <fieldset key={c.key} className="border-b border-gray-100 py-4">
          <legend className="mb-1 text-base font-bold text-gray-900">
            {isEn ? c.en : c.ar}
          </legend>
          {/* dir=ltr keeps 1 → 5 left-to-right on both languages, so the
              fill-up behaviour is the same everywhere. */}
          <div className="flex justify-center gap-1" dir="ltr">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRatings((r) => ({ ...r, [c.key]: n }))}
                aria-label={`${isEn ? c.en : c.ar}: ${n}/5`}
                aria-pressed={ratings[c.key] === n}
                className="rounded p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-nassayem"
              >
                <Star filled={(ratings[c.key] ?? 0) >= n} />
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="border-b border-gray-100 py-4">
        <legend className="mb-3 text-base font-bold text-gray-900">
          {isEn ? "Would you recommend us to your friends?" : "هل تنصح أصدقاءك بنا؟"}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: true, label: isEn ? "Yes" : "نعم" },
            { v: false, label: isEn ? "No" : "لا" },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setRecommend(o.v)}
              aria-pressed={recommend === o.v}
              className={`rounded-xl border py-3 text-base font-bold transition-colors ${
                recommend === o.v
                  ? "border-nassayem bg-nassayem text-white"
                  : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="py-4">
        <label htmlFor="comment" className="mb-2 block text-base font-bold text-gray-900">
          {isEn ? "Notes (optional)" : "ملاحظة (اختياري)"}
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
          rows={3}
          placeholder={isEn ? "Write your note here" : "اكتب ملاحظتك هنا"}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-nassayem focus:outline-none focus:ring-1 focus:ring-nassayem"
        />
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!complete || busy}
        className="mb-4 w-full rounded-xl bg-nassayem py-4 text-lg font-extrabold text-white transition-colors hover:bg-nassayem-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (isEn ? "Sending…" : "جارٍ الإرسال…") : isEn ? "Send feedback" : "أرسل التقييم"}
      </button>
      {!complete && (
        <p className="pb-4 text-center text-xs text-gray-400">
          {isEn
            ? "Please rate all four items and answer the recommendation question."
            : "يرجى تقييم البنود الأربعة والإجابة عن سؤال التوصية."}
        </p>
      )}
    </form>
  );
}
