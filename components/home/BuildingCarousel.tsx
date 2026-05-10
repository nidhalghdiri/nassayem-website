"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Building {
  id: string;
  nameEn: string;
  nameAr: string;
  imageUrl: string | null;
  _count: {
    units: number;
  };
}

interface BuildingCarouselProps {
  buildings: Building[];
  locale: string;
}

const GAP_PX = 24; // matches Tailwind gap-6
const AUTOPLAY_MS = 4500;
const TOUCH_RESUME_MS = 4000;

export default function BuildingCarousel({
  buildings,
  locale,
}: BuildingCarouselProps) {
  const isEn = locale === "en";
  const scrollRef = useRef<HTMLDivElement>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Doubled so autoplay can reset scrollLeft to 0 invisibly — the second copy
  // is identical to the first, so the jump is not visible to the user.
  const items = buildings.length > 0 ? [...buildings, ...buildings] : [];

  const stepCard = useCallback(
    (dir: "prev" | "next") => {
      const el = scrollRef.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>("[data-card]");
      if (!card) return;
      const step = card.offsetWidth + GAP_PX;

      // In RTL, modern browsers use negative scrollLeft going right→left,
      // so "next" (visually forward) needs an inverted sign.
      const visualSign = dir === "next" ? 1 : -1;
      const localeSign = isEn ? 1 : -1;
      el.scrollBy({
        left: visualSign * localeSign * step,
        behavior: "smooth",
      });
    },
    [isEn]
  );

  const pauseTemporarily = useCallback(() => {
    setIsPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(
      () => setIsPaused(false),
      TOUCH_RESUME_MS
    );
  }, []);

  // Autoplay
  useEffect(() => {
    if (isPaused || buildings.length <= 1) return;
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
  }, [isPaused, buildings.length, stepCard]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  if (buildings.length === 0) return null;

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
        {items.map((building, idx) => (
          <Link
            href={`/${locale}/buildings/${building.id}`}
            key={`${building.id}-${idx}`}
            data-card
            className="group relative h-72 sm:h-80 w-72 sm:w-80 rounded-2xl overflow-hidden flex-shrink-0 snap-start shadow-md hover:shadow-xl transition-shadow"
          >
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors z-10" />
            <Image
              src={
                building.imageUrl ||
                "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=800&auto=format&fit=crop"
              }
              alt={isEn ? building.nameEn : building.nameAr}
              fill
              sizes="(max-width: 640px) 18rem, 20rem"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute bottom-0 inset-x-0 p-6 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <h3 className="text-2xl font-bold text-white mb-1">
                {isEn ? building.nameEn : building.nameAr}
              </h3>
              <p className="text-white/90 font-medium">
                {building._count.units}{" "}
                {isEn ? "Furnished Units" : "وحدات مفروشة"}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {buildings.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => stepCard("prev")}
            aria-label={isEn ? "Previous" : "السابق"}
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 left-2 lg:-left-4 rtl:left-auto rtl:right-2 rtl:lg:right-[-1rem] z-30 w-12 h-12 rounded-full bg-white shadow-xl border border-gray-200 items-center justify-center text-[#1d5455] hover:bg-[#deeff8] hover:scale-105 transition-all"
          >
            <svg
              className="w-5 h-5 rtl:scale-x-[-1]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => stepCard("next")}
            aria-label={isEn ? "Next" : "التالي"}
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 right-2 lg:-right-4 rtl:right-auto rtl:left-2 rtl:lg:left-[-1rem] z-30 w-12 h-12 rounded-full bg-white shadow-xl border border-gray-200 items-center justify-center text-[#1d5455] hover:bg-[#deeff8] hover:scale-105 transition-all"
          >
            <svg
              className="w-5 h-5 rtl:scale-x-[-1]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
