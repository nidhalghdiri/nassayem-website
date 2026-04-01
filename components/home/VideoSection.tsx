"use client";

import { useState } from "react";

type Video = {
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  youtubeId: string;
};

// Add your YouTube video IDs here (the part after ?v= in the URL)
const VIDEOS: Video[] = [
  {
    titleEn: "Nassayem Building Tour",
    titleAr: "جولة في مبنى نسائم",
    descEn: "Explore our premium furnished apartments in Salalah.",
    descAr: "استكشف شققنا المفروشة الراقية في صلالة.",
    youtubeId: "dQw4w9WgXcQ", // Replace with your actual YouTube video ID
  },
  {
    titleEn: "Apartment Walkthrough",
    titleAr: "جولة داخل الشقة",
    descEn: "A detailed look at our fully furnished units.",
    descAr: "نظرة تفصيلية على وحداتنا المفروشة بالكامل.",
    youtubeId: "dQw4w9WgXcQ", // Replace with your actual YouTube video ID
  },
  {
    titleEn: "Khareef Season Special",
    titleAr: "خاص بموسم الخريف",
    descEn: "Experience Salalah during the magical Khareef season.",
    descAr: "استمتع بصلالة في موسم الخريف الساحر.",
    youtubeId: "dQw4w9WgXcQ", // Replace with your actual YouTube video ID
  },
];

function VideoCard({ video, isEn }: { video: Video; isEn: boolean }) {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`;

  return (
    <div className="group rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white hover:shadow-md transition-shadow">
      {/* Embed area */}
      <div className="relative aspect-video bg-gray-900">
        {playing ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={isEn ? video.titleEn : video.titleAr}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {/* Thumbnail */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt={isEn ? video.titleEn : video.titleAr}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // Fallback to hqdefault if maxresdefault not available
                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
              }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
            {/* Play button */}
            <button
              onClick={() => setPlaying(true)}
              className="absolute inset-0 flex items-center justify-center"
              aria-label={isEn ? "Play video" : "تشغيل الفيديو"}
            >
              <div className="w-16 h-16 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all group-hover:scale-110">
                <svg
                  className="w-7 h-7 text-nassayem ms-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 text-base leading-snug">
          {isEn ? video.titleEn : video.titleAr}
        </h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          {isEn ? video.descEn : video.descAr}
        </p>
      </div>
    </div>
  );
}

type Props = { locale: string };

export default function VideoSection({ locale }: Props) {
  const isEn = locale === "en";

  if (VIDEOS.length === 0) return null;

  return (
    <section className="py-24 bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-nassayem tracking-widest uppercase mb-3">
            {isEn ? "Building Tours" : "جولات المباني"}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            {isEn ? "See It for Yourself" : "شاهد بنفسك"}
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            {isEn
              ? "Take a virtual tour of our premium furnished apartments in Salalah."
              : "استمتع بجولة افتراضية في شققنا المفروشة الفاخرة في صلالة."}
          </p>
        </div>

        {/* Videos grid */}
        <div
          className={`grid gap-6 ${
            VIDEOS.length === 1
              ? "max-w-2xl mx-auto"
              : VIDEOS.length === 2
                ? "grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {VIDEOS.map((video, idx) => (
            <VideoCard key={idx} video={video} isEn={isEn} />
          ))}
        </div>
      </div>
    </section>
  );
}
