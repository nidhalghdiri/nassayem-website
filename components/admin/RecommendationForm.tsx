"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import type { Recommendation, RecommendationCategory } from "@prisma/client";
import {
  createRecommendation,
  updateRecommendation,
} from "@/app/actions/recommendation";
import { RECOMMENDATION_CATEGORIES } from "@/lib/recommendations";

type Props = {
  locale: string;
  initialData?: Recommendation;
};

const CATEGORY_KEYS: RecommendationCategory[] = [
  "BEACH",
  "MOUNTAIN",
  "WATERFALL",
  "WADI",
  "CULTURAL",
  "RESTAURANT",
  "ACTIVITY",
  "EVENT",
  "OTHER",
];

export default function RecommendationForm({ locale, initialData }: Props) {
  const isEn = locale === "en";
  const isEditing = !!initialData;
  const [isPending, startTransition] = useTransition();
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialData?.imageUrl ?? null,
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCompressedFile(null);
      return;
    }
    let working = file;
    if (file.size > 1024 * 1024) {
      setIsCompressing(true);
      try {
        working = await imageCompression(file, {
          maxSizeMB: 0.9,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
      } catch (err) {
        console.error("Compression failed:", err);
      } finally {
        setIsCompressing(false);
      }
    }
    setCompressedFile(working);
    setPreviewUrl(URL.createObjectURL(working));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (compressedFile) {
      formData.set("image", compressedFile);
    }
    setError(null);
    startTransition(async () => {
      try {
        if (isEditing && initialData) {
          await updateRecommendation(initialData.id, formData, locale);
        } else {
          await createRecommendation(formData, locale);
        }
      } catch (err: any) {
        setError(err?.message || (isEn ? "Save failed" : "فشل الحفظ"));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bilingual title + description */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Recommendation Details" : "تفاصيل التوصية"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* English */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Title (English) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="titleEn"
                defaultValue={initialData?.titleEn}
                required
                placeholder="e.g. Wadi Darbat"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Description (English)
              </label>
              <textarea
                name="descriptionEn"
                defaultValue={initialData?.descriptionEn ?? ""}
                rows={5}
                placeholder="A lush valley with waterfalls and lakes that come alive during Khareef..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem resize-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tags (English)
                <span className="ms-2 text-xs font-normal text-gray-400">
                  comma-separated
                </span>
              </label>
              <input
                type="text"
                name="tagsEn"
                defaultValue={initialData?.tagsEn?.join(", ") ?? ""}
                placeholder="Family-friendly, Free entry, Photos"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem"
                dir="ltr"
              />
            </div>
          </div>

          {/* Arabic */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                العنوان (عربي) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="titleAr"
                defaultValue={initialData?.titleAr}
                required
                placeholder="مثال: وادي دربات"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem text-right"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                الوصف (عربي)
              </label>
              <textarea
                name="descriptionAr"
                defaultValue={initialData?.descriptionAr ?? ""}
                rows={5}
                placeholder="وادٍ خصب بشلالات وبحيرات تنبض بالحياة في الخريف..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem resize-none text-right"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                الوسوم (عربي)
                <span className="ms-2 text-xs font-normal text-gray-400">
                  مفصولة بفواصل
                </span>
              </label>
              <input
                type="text"
                name="tagsAr"
                defaultValue={initialData?.tagsAr?.join("، ") ?? ""}
                placeholder="مناسب للعائلة، دخول مجاني، تصوير"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem text-right"
                dir="rtl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category + map + ordering */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Category & Location" : "التصنيف والموقع"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Category" : "التصنيف"} <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              defaultValue={initialData?.category ?? "OTHER"}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem"
            >
              {CATEGORY_KEYS.map((key) => {
                const cfg = RECOMMENDATION_CATEGORIES[key];
                return (
                  <option key={key} value={key}>
                    {isEn ? cfg.labelEn : cfg.labelAr}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Display Order" : "ترتيب العرض"}
              <span className="ms-2 text-xs font-normal text-gray-400">
                {isEn ? "lower = first" : "الأصغر يظهر أولاً"}
              </span>
            </label>
            <input
              type="number"
              name="displayOrder"
              defaultValue={initialData?.displayOrder ?? 0}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Google Maps Link" : "رابط الخرائط"}
              <span className="ms-2 text-xs font-normal text-gray-400">
                ({isEn ? "optional" : "اختياري"})
              </span>
            </label>
            <input
              type="url"
              name="mapUrl"
              defaultValue={initialData?.mapUrl ?? ""}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem"
              dir="ltr"
            />
            <p className="text-xs text-gray-400 mt-1">
              {isEn
                ? "Paste any Google Maps share link. Shown as 'Open in Maps' on the public page."
                : "ألصق أي رابط مشاركة من خرائط جوجل. يظهر كـ 'افتح في الخرائط' في الصفحة العامة."}
            </p>
          </div>
        </div>
      </div>

      {/* Cover image */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Cover Image" : "صورة الغلاف"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
          {previewUrl && (
            <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                sizes="200px"
                className="object-cover"
              />
            </div>
          )}
          <div className={previewUrl ? "" : "md:col-span-2"}>
            <input
              type="file"
              name="image"
              accept="image/jpeg, image/png, image/webp"
              onChange={handleFileChange}
              disabled={isPending || isCompressing}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-nassayem/10 file:text-nassayem hover:file:bg-nassayem/20 cursor-pointer border border-gray-200 rounded-xl disabled:opacity-50"
            />
            {isCompressing && (
              <p className="text-xs text-nassayem font-bold mt-2 animate-pulse">
                {isEn ? "Optimizing image..." : "جاري تحسين الصورة..."}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {isEditing
                ? isEn
                  ? "Leave empty to keep the existing image."
                  : "اتركه فارغاً للاحتفاظ بالصورة الحالية."
                : isEn
                  ? "JPG/PNG/WEBP. Auto-compressed if larger than 1 MB."
                  : "JPG/PNG/WEBP. يتم ضغط الصورة تلقائياً إذا تجاوزت 1 ميغابايت."}
            </p>
          </div>
        </div>
      </div>

      {/* Publish toggle + actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={initialData?.isPublished ?? true}
            className="w-5 h-5 text-nassayem rounded-md focus:ring-nassayem border-gray-300"
          />
          <span className="font-bold text-gray-900">
            {isEn ? "Publish on website" : "نشر على الموقع"}
          </span>
        </label>

        {error && (
          <p className="text-sm font-bold text-red-600 flex-1 text-center sm:text-end">
            {error}
          </p>
        )}

        <div className="flex gap-3 w-full sm:w-auto">
          <Link
            href={`/${locale}/admin/recommendations`}
            className="flex-1 sm:flex-none text-center px-6 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {isEn ? "Cancel" : "إلغاء"}
          </Link>
          <button
            type="submit"
            disabled={isPending || isCompressing}
            className="flex-1 sm:flex-none px-8 py-3 rounded-xl font-bold text-white bg-nassayem hover:bg-nassayem-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isEn ? "Saving..." : "جارٍ الحفظ..."}
              </>
            ) : isEditing ? (
              isEn ? "Save Changes" : "حفظ التغييرات"
            ) : (
              isEn ? "Create Recommendation" : "إنشاء توصية"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
