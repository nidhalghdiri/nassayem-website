"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Promotion {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  imageUrl: string | null;
  startDate: Date | string;
  endDate: Date | string;
  minPromoPrice: number | null;
}

interface Props {
  promotions: Promotion[];
  locale: string;
}

const GAP_PX = 24;
const AUTOPLAY_MS = 5500;
const TOUCH_RESUME_MS = 4000;

function formatDate(d: Date | string, isEn: boolean) {
  return new Date(d).toLocaleDateString(isEn ? "en-GB" : "ar-OM", {
    day: "numeric",
    month: "short",
  });
}

export default function PromotionsCarousel({ promotions, locale }: Props) {
  const isEn = locale === "en";
  const scrollRef = useRef<HTMLDivElement>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const items = promotions.length > 0 ? [...promotions, ...promotions] : [];

  const stepCard = useCallback(
    (dir: "prev" | "next") => {
      const el = scrollRef.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>("[data-card]");
      if (!card) return;
      const step = card.offsetWidth + GAP_PX;
      const visualSign = dir === "next" ? 1 : -1;
      const localeSign = isEn ? 1 : -1;
      el.scrollBy({ left: visualSign * localeSign * step, behavior: "smooth" });
    },
    [isEn],
  );

  const pauseTemporarily = useCallback(() => {
    setIsPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setIsPaused(false), TOUCH_RESUME_MS);
  }, []);

  useEffect(() => {
    if (isPaused || promotions.length <= 1) return;
    const id = window.setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      const absLeft = Math.abs(el.scrollLeft);
      if (absLeft >= max - 2) {
        el.scrollTo({ left: 0, behavior: "auto" });
      } else {
        stepCard("next");
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [isPaused, promotions.length, stepCard]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  if (promotions.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={pauseTemporarily}
    >
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory py-10 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
      >
        {items.map((promo, idx) => (
          <Link
            href={`/${locale}/promotions/${promo.id}`}
            key={`${promo.id}-${idx}`}
            data-card
            className="group relative h-80 sm:h-96 w-72 sm:w-[22rem] rounded-2xl overflow-hidden flex-shrink-0 snap-start shadow-md hover:shadow-xl transition-shadow"
          >
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors z-10" />
            <Image
              src={
                promo.imageUrl ||
                "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=800&auto=format&fit=crop"
              }
              alt={isEn ? promo.titleEn : promo.titleAr}
              fill
              sizes="(max-width: 640px) 18rem, 22rem"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
            {/* Promo badge */}
            <div className="absolute top-4 start-4 z-20">
              <span className="inline-flex items-center gap-1.5 bg-[#2a7475] text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                </svg>
                {isEn ? "Promotion" : "عرض"}
              </span>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-6 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1.5 leading-tight">
                {isEn ? promo.titleEn : promo.titleAr}
              </h3>
              <p className="text-white/80 text-xs font-medium mb-2">
                {formatDate(promo.startDate, isEn)} → {formatDate(promo.endDate, isEn)}
              </p>
              {promo.minPromoPrice !== null && (
                <p className="text-white/95 text-sm">
                  {isEn ? "From " : "ابتداءً من "}
                  <span className="font-extrabold text-base">
                    {promo.minPromoPrice} {isEn ? "OMR" : "ر.ع"}
                  </span>
                  {isEn ? " / night" : " / ليلة"}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {promotions.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => stepCard("prev")}
            aria-label={isEn ? "Previous" : "السابق"}
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 left-2 lg:-left-4 rtl:left-auto rtl:right-2 rtl:lg:right-[-1rem] z-30 w-12 h-12 rounded-full bg-white shadow-xl border border-gray-200 items-center justify-center text-[#1d5455] hover:bg-[#deeff8] hover:scale-105 transition-all"
          >
            <svg className="w-5 h-5 rtl:scale-x-[-1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => stepCard("next")}
            aria-label={isEn ? "Next" : "التالي"}
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 right-2 lg:-right-4 rtl:right-auto rtl:left-2 rtl:lg:left-[-1rem] z-30 w-12 h-12 rounded-full bg-white shadow-xl border border-gray-200 items-center justify-center text-[#1d5455] hover:bg-[#deeff8] hover:scale-105 transition-all"
          >
            <svg className="w-5 h-5 rtl:scale-x-[-1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
