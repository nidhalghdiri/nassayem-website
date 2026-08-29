"use client";

import { useState, useTransition, useEffect } from "react";
import { getBuildingUnitTypes, updateMonthlyPrice } from "@/app/actions/monthlyPricing";
import type { UnitType } from "@prisma/client";

type BuildingOption = { id: string; nameEn: string; nameAr: string };

const UNIT_TYPES_META: Record<string, { en: string; ar: string }> = {
  STUDIO: { en: "Studio", ar: "استوديو" },
  ONE_BEDROOM: { en: "1 Bedroom", ar: "غرفة فقط" },
  TWO_BEDROOM: { en: "2 Bedrooms", ar: "غرفتين وصالة" },
  THREE_BEDROOM: { en: "3 Bedrooms", ar: "ثلاث غرف وصالة" },
  VILLA: { en: "Villa", ar: "فيلا" },
};

export default function MonthlyPricingClient({
  locale,
  buildings,
}: {
  locale: string;
  buildings: BuildingOption[];
}) {
  const isEn = locale === "en";

  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const [unitTypes, setUnitTypes] = useState<{ unitType: UnitType; currentPrice: number | null | "MIXED" }[]>([]);
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType | "">("");
  const [price, setPrice] = useState("");
  
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (buildingId) {
      setUnitTypes([]);
      setSelectedUnitType("");
      setPrice("");
      setSuccess(false);
      startTransition(async () => {
        try {
          const types = await getBuildingUnitTypes(buildingId);
          setUnitTypes(types);
          if (types.length > 0) {
            setSelectedUnitType(types[0].unitType);
          }
        } catch (err: any) {
          console.error(err);
        }
      });
    }
  }, [buildingId]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!selectedUnitType) return;

    let finalPrice: number | null = null;
    if (price.trim() !== "") {
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setError(isEn ? "Enter a valid non-negative price." : "أدخل سعراً صحيحاً غير سالب.");
        return;
      }
      finalPrice = priceNum;
    }

    startTransition(async () => {
      try {
        await updateMonthlyPrice(buildingId, selectedUnitType as UnitType, finalPrice, locale);
        setSuccess(true);
        // Refresh current price display
        const types = await getBuildingUnitTypes(buildingId);
        setUnitTypes(types);
        setPrice("");
      } catch (err: any) {
        setError(err?.message || (isEn ? "Failed to save" : "فشل الحفظ"));
      }
    });
  };

  const currentTypeInfo = unitTypes.find(u => u.unitType === selectedUnitType);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Building */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "Building" : "المبنى"} <span className="text-red-500">*</span>
          </label>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {isEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>
        </div>

        {/* Unit Type */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "Unit Type" : "نوع الوحدة"} <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedUnitType}
            onChange={(e) => {
              setSelectedUnitType(e.target.value as UnitType);
              setSuccess(false);
            }}
            required
            disabled={unitTypes.length === 0}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 disabled:opacity-50"
          >
            {unitTypes.map((u) => (
              <option key={u.unitType} value={u.unitType}>
                {isEn ? UNIT_TYPES_META[u.unitType]?.en : UNIT_TYPES_META[u.unitType]?.ar}
              </option>
            ))}
          </select>
          {unitTypes.length === 0 && !isPending && (
            <p className="text-xs text-amber-600 mt-1">
              {isEn ? "No units found in this building." : "لم يتم العثور على وحدات في هذا المبنى."}
            </p>
          )}
        </div>

        {/* Current Price Info */}
        <div className="md:col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
          <span className="text-sm text-gray-600 font-medium">
            {isEn ? "Current Monthly Price:" : "السعر الشهري الحالي:"}
          </span>
          <span className="font-bold text-gray-900">
            {currentTypeInfo ? (
              currentTypeInfo.currentPrice === "MIXED" 
                ? (isEn ? "Mixed (units have different prices)" : "متعدد (للوحدات أسعار مختلفة)")
                : currentTypeInfo.currentPrice === null 
                  ? (isEn ? "Not set" : "غير محدد")
                  : `${currentTypeInfo.currentPrice} OMR`
            ) : (
              "-"
            )}
          </span>
        </div>

        {/* Price */}
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "New Monthly Price (OMR)" : "السعر الشهري الجديد (ر.ع)"}{" "}
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="0"
            step="0.001"
            placeholder={isEn ? "Leave empty to remove price, e.g. 450.000" : "اتركه فارغاً لإزالة السعر، مثلاً 450.000"}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            {isEn
              ? "This price will be applied to ALL units of this type in the selected building, overwriting their current monthly price."
              : "سيُطبَّق هذا السعر على كل الوحدات من هذا النوع في المبنى المحدد، مستبدلاً السعر الشهري الحالي."}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-sm rounded-xl border border-emerald-100">
          <p className="font-bold mb-1">
            {isEn ? "Monthly price updated" : "تم تحديث السعر الشهري"}
          </p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending || !selectedUnitType}
          className="bg-nassayem text-white px-8 py-3 rounded-xl font-bold hover:bg-nassayem-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isPending ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isEn ? "Saving..." : "جارٍ الحفظ..."}
            </>
          ) : isEn ? (
            "Update Monthly Price"
          ) : (
            "تحديث السعر الشهري"
          )}
        </button>
      </div>
    </form>
  );
}
