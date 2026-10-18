"use client";

import { useEffect, useRef, useState } from "react";

type Section = { id: string; label: string };

/**
 * Sticky, horizontally scrollable chip bar that highlights the section
 * currently on screen. Sits just under the 64px sticky Navbar.
 */
export default function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActive(visible[0].target.id);
        }
      },
      // Treat a section as "current" while it crosses the upper band of the viewport.
      { rootMargin: "-130px 0px -55% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active chip centred inside the scrollable bar. Scroll the bar
  // itself — scrollIntoView() would also scroll the window to the sticky bar's
  // position, yanking the page back up while the guest is scrolling.
  useEffect(() => {
    const bar = barRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!bar || !chip) return;
    const barRect = bar.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const delta = chipRect.left + chipRect.width / 2 - (barRect.left + barRect.width / 2);
    bar.scrollBy({ left: delta, behavior: "smooth" });
  }, [active]);

  return (
    <nav
      aria-label="Guide sections"
      className="sticky top-16 z-30 -mx-4 sm:mx-0 bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/75 border-b border-gray-200/70 sm:rounded-2xl sm:border"
    >
      <div ref={barRef} className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <a
              key={s.id}
              data-id={s.id}
              href={`#${s.id}`}
              aria-current={isActive ? "true" : undefined}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-nassayem text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-nassayem/40 hover:text-nassayem"
              }`}
            >
              {s.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
