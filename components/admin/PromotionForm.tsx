"use client";

import { useState, useTransition } from "react";
import { createPromotion, updatePromotion } from "@/app/actions/promotion";
import Link from "next/link";
import imageCompression from "browser-image-compression";

type BuildingOption = { id: string; nameEn: string; nameAr: string };

type PromotionRow = {
  id?: string;
  buildingId: string | null;
  unitType: string | null;
  regularPrice: number | "";
  promoPrice: number | "";
};

type InitialPromotion = {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  imageUrl: string | null;
  startDate: Date | string;
  endDate: Date | string;
  isActive: boolean;
  rows: {
    id: string;
    buildingId: string | null;
    unitType: string | null;
    regularPrice: number;
    promoPrice: number;
  }[];
};

const UNIT_TYPES: { value: string; en: string; ar: string }[] = [
  { value: "STUDIO", en: "Studio", ar: "استوديو" },
  { value: "ONE_BEDROOM", en: "1 Bedroom", ar: "غرفة وصالة" },
  { value: "TWO_BEDROOM", en: "2 Bedrooms", ar: "غرفتين وصالة" },
  { value: "THREE_BEDROOM", en: "3 Bedrooms", ar: "ثلاث غرف وصالة" },
  { value: "VILLA", en: "Villa", ar: "فيلا" },
];

function emptyRow(): PromotionRow {
  return {
    buildingId: null,
    unitType: null,
    regularPrice: "",
    promoPrice: "",
  };
}

function toDateInput(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().split("T")[0];
}

export default function PromotionForm({
  locale,
  buildings,
  initialData,
}: {
  locale: string;
  buildings: BuildingOption[];
  initialData?: InitialPromotion;
}) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PromotionRow[]>(
    initialData?.rows && initialData.rows.length > 0
      ? initialData.rows.map((r) => ({
          id: r.id,
          buildingId: r.buildingId,
          unitType: r.unitType,
          regularPrice: r.regularPrice,
          promoPrice: r.promoPrice,
        }))
      : [emptyRow()],
  );
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
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.9,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        setCompressedFile(compressed);
      } catch {
        setCompressedFile(file);
      } finally {
        setIsCompressing(false);
      }
    } else {
      setCompressedFile(file);
    }
  };

  const updateRow = (idx: number, patch: Partial<PromotionRow>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx: number) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.regularPrice === "" || r.promoPrice === "") {
        setError(
          isEn
            ? `Row ${i + 1}: regular and promotion prices are required.`
            : `الصف ${i + 1}: السعر العادي وسعر العرض مطلوبان.`,
        );
        return;
      }
      if (Number(r.promoPrice) >= Number(r.regularPrice)) {
        setError(
          isEn
            ? `Row ${i + 1}: promotion price must be lower than regular price.`
            : `الصف ${i + 1}: يجب أن يكون سعر العرض أقل من السعر العادي.`,
        );
        return;
      }
    }

    const formData = new FormData(e.currentTarget);
    if (compressedFile) {
      formData.set("image", compressedFile);
    }
    formData.set("rows", JSON.stringify(rows));

    startTransition(() => {
      if (isEditing && initialData) {
        updatePromotion(initialData.id, formData, locale);
      } else {
        createPromotion(formData, locale);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Basic details */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Promotion Details" : "تفاصيل العرض"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                placeholder="e.g. Khareef Starting Promotion"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Description (English)
              </label>
              <textarea
                name="descriptionEn"
                defaultValue={initialData?.descriptionEn ?? ""}
                rows={4}
                placeholder="What is included in this promotion..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr resize-none"
              />
            </div>
          </div>

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
                placeholder="مثال: عرض بداية الخريف"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-right">
                الوصف (عربي)
              </label>
              <textarea
                name="descriptionAr"
                defaultValue={initialData?.descriptionAr ?? ""}
                rows={4}
                placeholder="ما الذي يشمله هذا العرض..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all text-right dir-rtl resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Period + status */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Period" : "الفترة"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Start date" : "تاريخ البدء"} *
            </label>
            <input
              type="date"
              name="startDate"
              defaultValue={initialData ? toDateInput(initialData.startDate) : ""}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "End date" : "تاريخ الانتهاء"} *
            </label>
            <input
              type="date"
              name="endDate"
              defaultValue={initialData ? toDateInput(initialData.endDate) : ""}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Status" : "الحالة"}
            </label>
            <label className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={initialData ? initialData.isActive : true}
                className="w-5 h-5 accent-nassayem"
              />
              <span className="text-sm font-medium text-gray-700">
                {isEn ? "Active (visible on website)" : "نشط (يظهر في الموقع)"}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Promotion Image" : "صورة العرض"}
        </h2>
        {initialData?.imageUrl && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">
              {isEn ? "Current image:" : "الصورة الحالية:"}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initialData.imageUrl}
              alt=""
              className="w-48 h-32 object-cover rounded-xl border border-gray-200"
            />
          </div>
        )}
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
      </div>

      {/* Condition rows */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEn ? "Conditions" : "الشروط"}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {isEn
                ? "Each row defines which units the promotion applies to and the discounted daily price."
                : "كل صف يحدد الوحدات التي ينطبق عليها العرض والسعر اليومي المخفض."}
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v12m6-6H6" />
            </svg>
            {isEn ? "Add Row" : "إضافة صف"}
          </button>
        </div>

        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-[1.4fr_1.4fr_1fr_1fr_auto] gap-3 items-end p-4 bg-gray-50 rounded-xl border border-gray-100"
            >
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                  {isEn ? "Building" : "المبنى"}
                </label>
                <select
                  value={row.buildingId ?? ""}
                  onChange={(e) =>
                    updateRow(idx, { buildingId: e.target.value || null })
                  }
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
                >
                  <option value="">
                    {isEn ? "All buildings" : "جميع المباني"}
                  </option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isEn ? b.nameEn : b.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                  {isEn ? "Unit Type" : "نوع الوحدة"}
                </label>
                <select
                  value={row.unitType ?? ""}
                  onChange={(e) =>
                    updateRow(idx, { unitType: e.target.value || null })
                  }
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
                >
                  <option value="">
                    {isEn ? "All types" : "جميع الأنواع"}
                  </option>
                  {UNIT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {isEn ? t.en : t.ar}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                  {isEn ? "Regular (OMR)" : "العادي (ر.ع)"}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={row.regularPrice}
                  onChange={(e) =>
                    updateRow(idx, {
                      regularPrice: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  required
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                  {isEn ? "Promo (OMR)" : "العرض (ر.ع)"}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={row.promoPrice}
                  onChange={(e) =>
                    updateRow(idx, {
                      promoPrice: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  required
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                disabled={rows.length === 1}
                title={isEn ? "Remove row" : "حذف الصف"}
                className="h-[42px] px-3 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <Link
          href={`/${locale}/admin/promotions`}
          className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {isEn ? "Cancel" : "إلغاء"}
        </Link>
        <button
          type="submit"
          disabled={isPending || isCompressing}
          className="px-8 py-3 rounded-xl font-bold text-white bg-nassayem hover:bg-nassayem-dark transition-colors flex items-center justify-center min-w-[160px] disabled:opacity-50"
        >
          {isPending ? (
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : isEditing ? (
            isEn ? "Save Changes" : "حفظ التغييرات"
          ) : isEn ? (
            "Create Promotion"
          ) : (
            "إنشاء العرض"
          )}
        </button>
      </div>
    </form>
  );
}
