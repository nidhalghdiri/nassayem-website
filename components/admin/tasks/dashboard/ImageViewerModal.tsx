import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Photo = {
  id: string;
  url: string;
};

type Props = {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  isEn?: boolean;
};

export default function ImageViewerModal({ photos, initialIndex, onClose, isEn = true }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, onClose]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors z-[101]"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation - Left */}
      {photos.length > 1 && (
        <button
          onClick={handlePrev}
          className={`absolute left-4 p-3 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors z-[101]`}
        >
          {isEn ? <ChevronLeft className="w-8 h-8" /> : <ChevronRight className="w-8 h-8" />}
        </button>
      )}

      {/* Navigation - Right */}
      {photos.length > 1 && (
        <button
          onClick={handleNext}
          className={`absolute right-4 p-3 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors z-[101]`}
        >
          {isEn ? <ChevronRight className="w-8 h-8" /> : <ChevronLeft className="w-8 h-8" />}
        </button>
      )}

      {/* Image container */}
      <div className="relative w-full max-w-5xl h-full max-h-[85vh] p-4 flex flex-col items-center justify-center">
        <img
          src={currentPhoto.url}
          alt={`Photo ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain select-none"
        />
        
        {/* Counter */}
        {photos.length > 1 && (
          <div className="absolute bottom-[-2rem] text-white/80 font-medium">
            {currentIndex + 1} / {photos.length}
          </div>
        )}
      </div>
    </div>
  );
}
