"use client";

import { useState, useTransition } from "react";
import { createPost, updatePost } from "@/app/actions/post";
import Link from "next/link";
import imageCompression from "browser-image-compression";

export default function PostForm({
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

    if (compressedFile) {
      formData.set("image", compressedFile);
    }

    startTransition(async () => {
      if (isEditing && initialData.id) {
        await updatePost(initialData.id, formData, locale);
      } else {
        await createPost(formData, locale);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Basic Details (Split EN/AR) */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Article Details" : "تفاصيل المقال"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* English Side */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Title (English) *
              </label>
              <input
                type="text"
                name="titleEn"
                defaultValue={initialData?.titleEn}
                required
                placeholder="e.g. Best things to do in Salalah"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Excerpt (English)
              </label>
              <textarea
                name="excerptEn"
                defaultValue={initialData?.excerptEn}
                rows={2}
                placeholder="Brief summary for list view..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Content (English) *
              </label>
              <textarea
                name="contentEn"
                defaultValue={initialData?.contentEn}
                required
                rows={12}
                placeholder="Write your article content here..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all resize-none"
              />
            </div>
          </div>

          {/* Arabic Side */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                العنوان (عربي) *
              </label>
              <input
                type="text"
                name="titleAr"
                defaultValue={initialData?.titleAr}
                required
                placeholder="مثال: أفضل الأشياء للقيام بها في صلالة"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                مقتطف (عربي)
              </label>
              <textarea
                name="excerptAr"
                defaultValue={initialData?.excerptAr}
                rows={2}
                placeholder="ملخص قصير لعرض القائمة..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                المحتوى (عربي) *
              </label>
              <textarea
                name="contentAr"
                defaultValue={initialData?.contentAr}
                required
                rows={12}
                placeholder="اكتب محتوى مقالك هنا..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Cover Image */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Cover Image" : "صورة الغلاف"}
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

      {/* 3. Settings & Actions */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={initialData?.isPublished}
            className="w-6 h-6 text-nassayem rounded-md focus:ring-nassayem border-gray-300"
          />
          <span className="font-bold text-gray-900">
            {isEn ? "Publish Article" : "نشر المقال"}
          </span>
        </label>

        <div className="flex gap-4 w-full sm:w-auto">
          <Link
            href={`/${locale}/admin/blog`}
            className="flex-1 sm:flex-none text-center px-6 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {isEn ? "Cancel" : "إلغاء"}
          </Link>
          <button
            type="submit"
            disabled={isPending || isCompressing}
            className="flex-1 sm:flex-none px-8 py-3 rounded-xl font-bold text-white bg-nassayem hover:bg-nassayem-dark transition-colors flex items-center justify-center min-w-[140px] disabled:opacity-50"
          >
            {isPending ? "..." : isEn ? "Save Article" : "حفظ المقال"}
          </button>
        </div>
      </div>
    </form>
  );
}
