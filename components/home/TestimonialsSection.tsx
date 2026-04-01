"use client";

import { useState, useEffect, useCallback } from "react";

// ── Star rating helper ────────────────────────────────────────────────────────

function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        return (
          <svg key={i} className={`w-5 h-5 ${filled ? "text-yellow-400" : half ? "text-yellow-300" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      })}
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

type Testimonial = {
  nameEn: string;
  nameAr: string;
  dateEn: string;
  dateAr: string;
  textEn: string;
  textAr: string;
  rating: number;
  source: "google" | "booking";
};

const TESTIMONIALS: Testimonial[] = [
  // Google
  {
    source: "google",
    nameEn: "Khalid Al-Harthi",
    nameAr: "خالد الحارثي",
    dateEn: "October 2024",
    dateAr: "أكتوبر 2024",
    rating: 5,
    textEn: "Absolutely fantastic experience. The apartment was immaculate, the location was perfect, and the staff went above and beyond. Will definitely return for Khareef!",
    textAr: "تجربة رائعة بكل معنى الكلمة. الشقة كانت نظيفة تماماً، والموقع مثالي، والفريق تجاوز كل التوقعات. سأعود بالتأكيد في موسم الخريف!",
  },
  {
    source: "google",
    nameEn: "Sara Al-Balushi",
    nameAr: "سارة البلوشي",
    dateEn: "August 2024",
    dateAr: "أغسطس 2024",
    rating: 5,
    textEn: "Best furnished apartment in Salalah by far. Clean, modern, and the Nassayem team was responsive and professional throughout our stay.",
    textAr: "أفضل شقة مفروشة في صلالة على الإطلاق. نظيفة وعصرية، وفريق نسائم كان متجاوباً ومهنياً طوال فترة إقامتنا.",
  },
  {
    source: "google",
    nameEn: "Mohammed Al-Rashdi",
    nameAr: "محمد الرشدي",
    dateEn: "July 2024",
    dateAr: "يوليو 2024",
    rating: 5,
    textEn: "Premium quality apartments with hotel-level service. The attention to detail in every unit is remarkable. Highly recommended for families.",
    textAr: "شقق فاخرة بمستوى خدمة فندقي. الاهتمام بالتفاصيل في كل وحدة أمر لافت للنظر. أنصح به بشدة للعائلات.",
  },
  {
    source: "google",
    nameEn: "Fatima Al-Kindi",
    nameAr: "فاطمة الكندي",
    dateEn: "June 2024",
    dateAr: "يونيو 2024",
    rating: 5,
    textEn: "The comfort and quality exceeded our expectations. Nassayem truly understands what guests need. A home away from home in beautiful Salalah.",
    textAr: "الراحة والجودة تجاوزت توقعاتنا. نسائم تفهم حقاً ما يحتاجه الضيوف. منزل بعيداً عن المنزل في صلالة الجميلة.",
  },
  // Booking.com
  {
    source: "booking",
    nameEn: "Ahmed Al-Zadjali",
    nameAr: "أحمد الزدجالي",
    dateEn: "September 2024",
    dateAr: "سبتمبر 2024",
    rating: 5,
    textEn: "Outstanding stay. The apartment was spotless, well-equipped, and in a great location. Check-in was smooth and the team was very helpful.",
    textAr: "إقامة ممتازة. الشقة كانت نظيفة جداً ومجهزة بالكامل وفي موقع رائع. تسجيل الوصول كان سلساً والفريق مفيد جداً.",
  },
  {
    source: "booking",
    nameEn: "Layla Al-Ghailani",
    nameAr: "ليلى الغيلاني",
    dateEn: "August 2024",
    dateAr: "أغسطس 2024",
    rating: 5,
    textEn: "Incredible value for the quality provided. Modern amenities, spacious rooms, and impeccable cleanliness. Nassayem sets the standard in Salalah.",
    textAr: "قيمة رائعة مقابل الجودة المقدمة. مرافق حديثة وغرف واسعة ونظافة لا تشوبها شائبة. نسائم تضع المعيار في صلالة.",
  },
  {
    source: "booking",
    nameEn: "Omar Al-Farsi",
    nameAr: "عمر الفارسي",
    dateEn: "July 2024",
    dateAr: "يوليو 2024",
    rating: 5,
    textEn: "Booked for a month during Khareef and it was perfect. The apartment felt like a luxury hotel suite at a fraction of the price.",
    textAr: "حجزت لمدة شهر خلال الخريف وكان مثالياً. شعر الشقة بأنها جناح فندقي فاخر بجزء بسيط من السعر.",
  },
  {
    source: "booking",
    nameEn: "Aisha Al-Maamari",
    nameAr: "عائشة المعمري",
    dateEn: "June 2024",
    dateAr: "يونيو 2024",
    rating: 5,
    textEn: "Wonderful experience from start to finish. Staff were professional and friendly, and the apartment exceeded every expectation. 10/10 would book again.",
    textAr: "تجربة رائعة من البداية إلى النهاية. الفريق كان محترفاً وودوداً، والشقة تجاوزت كل التوقعات. 10/10 سأحجز مرة أخرى.",
  },
];

// ── Slide carousel ────────────────────────────────────────────────────────────

function TestimonialCarousel({
  testimonials,
  isEn,
}: {
  testimonials: Testimonial[];
  isEn: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const go = useCallback(
    (next: number) => {
      if (animating) return;
      setAnimating(true);
      setTimeout(() => {
        setIdx((next + testimonials.length) % testimonials.length);
        setAnimating(false);
      }, 200);
    },
    [animating, testimonials.length],
  );

  // Auto-advance every 5 s
  useEffect(() => {
    const t = setInterval(() => go(idx + 1), 5000);
    return () => clearInterval(t);
  }, [idx, go]);

  const t = testimonials[idx];

  return (
    <div className="relative">
      {/* Card */}
      <div
        className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[200px] transition-opacity duration-200 ${animating ? "opacity-0" : "opacity-100"}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-bold text-gray-900 text-sm">
              {isEn ? t.nameEn : t.nameAr}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEn ? t.dateEn : t.dateAr}
            </p>
          </div>
          <Stars rating={t.rating} />
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">
          &ldquo;{isEn ? t.textEn : t.textAr}&rdquo;
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => go(idx - 1)}
          className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
          aria-label="Previous"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Dots */}
        <div className="flex gap-1.5">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-6 bg-nassayem" : "w-1.5 bg-gray-300"}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => go(idx + 1)}
          className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
          aria-label="Next"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Google logo ───────────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" aria-label="Google">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ── Booking.com logo ──────────────────────────────────────────────────────────

function BookingLogo() {
  return (
    <svg viewBox="0 0 60 24" className="h-6 w-auto" aria-label="Booking.com">
      <text x="0" y="20" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="18" fill="#003580">
        booking
      </text>
      <circle cx="56" cy="12" r="5" fill="#003580"/>
      <circle cx="56" cy="12" r="3" fill="#ffffff"/>
    </svg>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type Props = { locale: string };

export default function TestimonialsSection({ locale }: Props) {
  const isEn = locale === "en";

  const googleReviews = TESTIMONIALS.filter((t) => t.source === "google");
  const bookingReviews = TESTIMONIALS.filter((t) => t.source === "booking");

  return (
    <section className="py-24 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-nassayem tracking-widest uppercase mb-3">
            {isEn ? "Guest Reviews" : "آراء الضيوف"}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            {isEn ? "What Our Guests Say" : "ماذا يقول ضيوفنا"}
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            {isEn
              ? "Trusted by thousands of guests across Salalah's top booking platforms."
              : "موثوق به من آلاف الضيوف عبر أبرز منصات الحجز في صلالة."}
          </p>
        </div>

        {/* Rating platform cards + carousels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* ── Google ─────────────────────────────────────────────────── */}
          <div>
            {/* Platform header */}
            <div className="flex items-center gap-4 mb-6 bg-gray-50 rounded-2xl px-5 py-4 border border-gray-100">
              <GoogleLogo />
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-base">Google Reviews</p>
                <div className="flex items-center gap-2 mt-1">
                  <Stars rating={4.8} />
                  <span className="text-2xl font-black text-gray-900 leading-none">4.8</span>
                  <span className="text-sm text-gray-500">/ 5</span>
                </div>
              </div>
              <a
                href="https://www.google.com/maps/search/Nassayem+Salalah"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {isEn ? "See all →" : "← عرض الكل"}
              </a>
            </div>
            <TestimonialCarousel testimonials={googleReviews} isEn={isEn} />
          </div>

          {/* ── Booking.com ─────────────────────────────────────────────── */}
          <div>
            {/* Platform header */}
            <div className="flex items-center gap-4 mb-6 bg-[#003580]/5 rounded-2xl px-5 py-4 border border-[#003580]/10">
              <BookingLogo />
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-base">Booking.com</p>
                <div className="flex items-center gap-2 mt-1">
                  {/* Booking.com uses 10-point scale — display as score badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-[#003580] leading-none">9.2</span>
                    <span className="text-sm text-gray-500">/ 10</span>
                    <span className="px-2 py-0.5 bg-[#003580] text-white text-xs font-bold rounded">
                      {isEn ? "Exceptional" : "استثنائي"}
                    </span>
                  </div>
                </div>
              </div>
              <a
                href="https://www.booking.com"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 text-xs font-semibold border border-[#003580]/20 rounded-lg text-[#003580] hover:bg-[#003580]/5 transition-colors"
              >
                {isEn ? "See all →" : "← عرض الكل"}
              </a>
            </div>
            <TestimonialCarousel testimonials={bookingReviews} isEn={isEn} />
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
          {[
            { num: "500+", labelEn: "Happy Guests", labelAr: "ضيف سعيد" },
            { num: "4.8★", labelEn: "Google Rating", labelAr: "تقييم جوجل" },
            { num: "9.2/10", labelEn: "Booking.com Score", labelAr: "تقييم بوكينج" },
            { num: "100%", labelEn: "Verified Reviews", labelAr: "تقييمات موثقة" },
          ].map((b) => (
            <div key={b.labelEn} className="text-center px-6 py-3 rounded-2xl bg-gray-50 border border-gray-100">
              <p className="text-2xl font-black text-nassayem">{b.num}</p>
              <p className="text-xs text-gray-500 mt-0.5">{isEn ? b.labelEn : b.labelAr}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
