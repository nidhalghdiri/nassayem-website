"use client";

import { useState, useTransition } from "react";
import { createBuilding, updateBuilding } from "@/app/actions/building";
import Link from "next/link";
import imageCompression from "browser-image-compression";

export default function BuildingForm({
  locale,
  initialData,
}: {
  locale: string;
  initialData?: any;
}) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const isEditing = !!initialData;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCompressedFile(null);
      return;
    }

    if (file.size > 1024 * 1024) {
      setIsCompressing(true);
      try {
        const options = {
          maxSizeMB: 0.9,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        const compressed = await imageCompression(file, options);
        setCompressedFile(compressed);
      } catch (error) {
        console.error("Compression failed:", error);
        setCompressedFile(file);
      } finally {
        setIsCompressing(false);
      }
    } else {
      setCompressedFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // If we have a compressed file, replace the one in formData
    if (compressedFile) {
      formData.set("image", compressedFile);
    }

    // Use React transition to show loading state while the Server Action runs
    startTransition(() => {
      if (isEditing && initialData.id) {
        updateBuilding(initialData.id, formData, locale);
      } else {
        createBuilding(formData, locale);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Basic Details (Split EN/AR) */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Building Details" : "تفاصيل المبنى"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* English Side */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Building Name (English) *
              </label>
              <input
                type="text"
                name="nameEn"
                defaultValue={initialData?.nameEn}
                required
                placeholder="e.g. Al Saadah Tower 1"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Location / Area (English) *
              </label>
              <input
                type="text"
                name="locationEn"
                defaultValue={initialData?.locationEn}
                required
                placeholder="e.g. North Awqad, Salalah"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Description (English)
              </label>
              <textarea
                name="descriptionEn"
                defaultValue={initialData?.descriptionEn}
                rows={4}
                placeholder="Brief description of the building..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr resize-none"
              />
            </div>
          </div>

          {/* Arabic Side */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right rtl:text-right">
                اسم المبنى (عربي) *
              </label>
              <input
                type="text"
                name="nameAr"
                defaultValue={initialData?.nameAr}
                required
                placeholder="مثال: برج السعادة 1"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right rtl:text-right">
                الموقع / المنطقة (عربي) *
              </label>
              <input
                type="text"
                name="locationAr"
                defaultValue={initialData?.locationAr}
                required
                placeholder="مثال: عوقد الشمالية، صلالة"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right rtl:text-right">
                الوصف (عربي)
              </label>
              <textarea
                name="descriptionAr"
                defaultValue={initialData?.descriptionAr}
                rows={4}
                placeholder="وصف موجز للمبنى..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Map Coordinates */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Map Coordinates (Optional)" : "إحداثيات الخريطة (اختياري)"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Latitude" : "خط العرض"}
            </label>
            <input
              type="number"
              step="any"
              name="latitude"
              defaultValue={initialData?.latitude}
              placeholder="17.0250"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Longitude" : "خط الطول"}
            </label>
            <input
              type="number"
              step="any"
              name="longitude"
              defaultValue={initialData?.longitude}
              placeholder="54.1000"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr"
            />
          </div>
        </div>
      </div>
      {/* 3. Building Cover Image (NEW SECTION) */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Building Cover Image" : "صورة غلاف المبنى"}
        </h2>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "Upload high-quality photo" : "رفع صورة عالية الجودة"}
          </label>
          <input
            type="file"
            name="image"
            accept="image/jpeg, image/png, image/webp"
            onChange={handleFileChange}
            disabled={isPending || isCompressing}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-nassayem/10 file:text-nassayem hover:file:bg-nassayem/20 cursor-pointer border border-gray-200 rounded-xl disabled:opacity-50"
          />
          {isCompressing && (
            <p className="text-xs text-nassayem font-bold mt-1 animate-pulse">
              {isEn ? "Optimizing image..." : "جاري تحسين الصورة..."}
            </p>
          )}
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div className="flex justify-end gap-4 pt-4">
        <Link
          href={`/${locale}/admin/buildings`}
          className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {isEn ? "Cancel" : "إلغاء"}
        </Link>
        <button
          type="submit"
          disabled={isPending || isCompressing}
          className="px-8 py-3 rounded-xl font-bold text-white bg-nassayem hover:bg-nassayem-dark transition-colors flex items-center justify-center min-w-[140px] disabled:opacity-50"
        >
          {isPending ? (
            <svg
              className="animate-spin h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : isEn ? (
            "Save Building"
          ) : (
            "حفظ المبنى"
          )}
        </button>
      </div>
    </form>
  );
}
