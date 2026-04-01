"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

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

export default function BuildingCarousel({
  buildings,
  locale,
}: BuildingCarouselProps) {
  const isEn = locale === "en";
  const [isPaused, setIsPaused] = useState(false);

  // Triple the buildings for a smooth infinite scroll
  const items = [...buildings, ...buildings, ...buildings];

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="flex"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <motion.div
          animate={{
            x: isPaused ? undefined : ["0%", "-33.33%"],
          }}
          transition={{
            duration: buildings.length * 5,
            ease: "linear",
            repeat: Infinity,
          }}
          className="flex gap-6 py-10"
          style={{ width: "fit-content" }}
        >
          {items.map((building, idx) => (
            <Link
              href={`/${locale}/buildings/${building.id}`}
              key={`${building.id}-${idx}`}
              className="group relative h-80 w-80 rounded-2xl overflow-hidden flex-shrink-0"
            >
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors z-10" />
              <Image
                src={
                  building.imageUrl ||
                  "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=800&auto=format&fit=crop"
                }
                alt={isEn ? building.nameEn : building.nameAr}
                fill
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
        </motion.div>
      </div>
    </div>
  );
}
