"use client";

import { useTransition } from "react";
import { createUnit, updateUnit } from "@/app/actions/unit";
import Link from "next/link";

// Define a lightweight type for the buildings prop
type BuildingOption = { id: string; nameEn: string; nameAr: string };

export default function UnitForm({
  locale,
  buildings,
  initialData,
}: {
  locale: string;
  buildings: BuildingOption[];
  initialData?: any;
}) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();
  const isEditing = !!initialData;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      if (isEditing && initialData.id) {
        updateUnit(initialData.id, formData, locale);
      } else {
        createUnit(formData, locale);
      }
    });
  };

  if (buildings.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-2xl text-center">
        <h3 className="text-yellow-800 font-bold mb-2">
          {isEn ? "No Buildings Found" : "لا يوجد مباني"}
        </h3>
        <p className="text-yellow-700 mb-4">
          {isEn
            ? "You must create a building first before adding units."
            : "يجب إنشاء مبنى أولاً قبل إضافة الوحدات."}
        </p>
        <Link
          href={`/${locale}/admin/buildings/new`}
          className="text-nassayem font-bold hover:underline"
        >
          {isEn ? "Add a Building →" : "إضافة مبنى ←"}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Core Association */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="max-w-md">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "Select Building *" : "اختر المبنى *"}
          </label>
          <select
            name="buildingId"
            defaultValue={initialData?.buildingId}
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all cursor-pointer"
          >
            <option value="">
              {isEn ? "-- Select a Building --" : "-- اختر مبنى --"}
            </option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {isEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Unit Details (EN/AR) */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Unit Details" : "تفاصيل الوحدة"}
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
                placeholder="e.g. Luxury Seaview Apartment"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Description (English) *
              </label>
              <textarea
                name="descriptionEn"
                defaultValue={initialData?.descriptionEn}
                required
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr resize-none"
              />
            </div>
          </div>

          {/* Arabic Side */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right rtl:text-right">
                العنوان (عربي) *
              </label>
              <input
                type="text"
                name="titleAr"
                defaultValue={initialData?.titleAr}
                required
                placeholder="مثال: شقة فاخرة بإطلالة بحرية"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right rtl:text-right">
                الوصف (عربي) *
              </label>
              <textarea
                name="descriptionAr"
                defaultValue={initialData?.descriptionAr}
                required
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Classification & Pricing */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Pricing & Type" : "التسعير والنوع"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Unit Type" : "نوع الوحدة"}
            </label>
            <select
              name="unitType"
              defaultValue={initialData?.unitType}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer focus:ring-2 focus:ring-nassayem/50"
            >
              <option value="STUDIO">{isEn ? "Studio" : "استوديو"}</option>
              <option value="ONE_BEDROOM">
                {isEn ? "1 Bedroom" : "غرفة وصالة"}
              </option>
              <option value="TWO_BEDROOM">
                {isEn ? "2 Bedrooms" : "غرفتين وصالة"}
              </option>
              <option value="VILLA">{isEn ? "Villa" : "فيلا"}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Rent Type" : "نوع الإيجار"}
            </label>
            <select
              name="rentType"
              defaultValue={initialData?.rentType}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer focus:ring-2 focus:ring-nassayem/50"
            >
              <option value="DAILY">{isEn ? "Daily Only" : "يومي فقط"}</option>
              <option value="MONTHLY">
                {isEn ? "Monthly Only" : "شهري فقط"}
              </option>
              <option value="BOTH">
                {isEn ? "Both (Daily & Monthly)" : "كلاهما (يومي وشهري)"}
              </option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Daily Price (OMR)" : "السعر اليومي (ر.ع)"}
            </label>
            <input
              type="number"
              step="0.5"
              name="dailyPrice"
              defaultValue={initialData?.dailyPrice}
              placeholder="0.00"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-nassayem/50"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Monthly Price (OMR)" : "السعر الشهري (ر.ع)"}
            </label>
            <input
              type="number"
              step="0.5"
              name="monthlyPrice"
              defaultValue={initialData?.monthlyPrice}
              placeholder="0.00"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-nassayem/50"
            />
          </div>
        </div>
      </div>

      {/* 4. Specifications */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Specifications" : "المواصفات"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {["guests", "bedrooms", "beds", "bathrooms"].map((spec) => (
            <div key={spec}>
              <label className="block text-sm font-bold text-gray-700 mb-2 capitalize">
                {isEn
                  ? spec
                  : spec === "guests"
                    ? "الضيوف"
                    : spec === "bedrooms"
                      ? "غرف النوم"
                      : spec === "beds"
                        ? "الأسرة"
                        : "الحمامات"}
              </label>
              <input
                type="number"
                name={spec}
                min="1"
                defaultValue={initialData[spec]}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-nassayem/50 text-center font-bold"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 5. Publish Toggle & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={initialData?.isPublished}
            className="w-6 h-6 text-nassayem rounded-md focus:ring-nassayem border-gray-300"
          />
          <span className="font-bold text-gray-900">
            {isEn ? "Publish immediately" : "نشر فوراً"}
          </span>
        </label>

        <div className="flex gap-4 w-full sm:w-auto">
          <Link
            href={`/${locale}/admin/units`}
            className="flex-1 sm:flex-none text-center px-6 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {isEn ? "Cancel" : "إلغاء"}
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 sm:flex-none px-8 py-3 rounded-xl font-bold text-white bg-nassayem hover:bg-nassayem-dark transition-colors flex items-center justify-center min-w-[140px]"
          >
            {isPending ? "..." : isEn ? "Save Unit" : "حفظ الوحدة"}
          </button>
        </div>
      </div>
    </form>
  );
}
