"use client";

import { Home, Building2, Filter, Layers } from "lucide-react";

export type UnitDemand = {
  type: string;
  count: number;
  pct: number;
};

export type BuildingDemand = {
  name: string;
  count: number;
  pct: number;
};

type Props = {
  isEn: boolean;
  unitDemands: UnitDemand[];
  buildingDemands: BuildingDemand[];
};

export default function DemandAnalytics({
  isEn,
  unitDemands,
  buildingDemands,
}: Props) {
  const formatUnitType = (t: string) => {
    const map: Record<string, { en: string; ar: string }> = {
      TWO_BEDROOM: { en: "2-Bedroom Apartment", ar: "شقة غرفتين وصالة" },
      ONE_BEDROOM: { en: "1-Bedroom Apartment", ar: "شقة غرفة وصالة" },
      STUDIO: { en: "Studio Apartment", ar: "استوديو" },
      THREE_BEDROOM: { en: "3-Bedroom Apartment", ar: "شقة 3 غرف وصالة" },
      CHALET: { en: "Chalet / Villa", ar: "شاليه / فيلا" },
      FOUR_BEDROOM: { en: "4-Bedroom Villa", ar: "فيلا 4 غرف" },
    };
    if (map[t]) return isEn ? map[t].en : map[t].ar;
    return t.replace(/_/g, " ");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Unit Type Demand */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-5 lg:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1B365D] flex items-center justify-center">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isEn ? "Demand by Apartment Type" : "حجم الطلب حسب نوع الشقة"}
              </h2>
              <p className="text-xs text-gray-500">
                {isEn ? "Aggregated from qualified booking leads" : "مستخرج من اهتمامات وحجوزات النزلاء"}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {unitDemands.reduce((s, u) => s + u.count, 0)} {isEn ? "Leads" : "طلب"}
          </span>
        </div>

        {unitDemands.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            {isEn ? "No unit interest data captured yet." : "لا توجد بيانات أنواع وحدات مسجلة بعد."}
          </p>
        ) : (
          <div className="space-y-3.5 pt-1">
            {unitDemands.map((item, idx) => {
              const colors = [
                "bg-[#1B365D]",
                "bg-blue-600",
                "bg-amber-500",
                "bg-emerald-600",
                "bg-purple-600",
              ];
              const barColor = colors[idx % colors.length];

              return (
                <div key={item.type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-800">{formatUnitType(item.type)}</span>
                    <span className="text-gray-600">
                      <strong>{item.count}</strong> ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Building / Location Demand */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-5 lg:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isEn ? "Demand by Building / Location" : "توزيع الطلب حسب المبنى والمنطقة"}
              </h2>
              <p className="text-xs text-gray-500">
                {isEn ? "Customer location and building preferences" : "المباني الأكثر تفضيلاً للعملاء في صلالة"}
              </p>
            </div>
          </div>
        </div>

        {buildingDemands.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            {isEn ? "No location data captured yet." : "لا توجد بيانات مواقع مسجلة بعد."}
          </p>
        ) : (
          <div className="space-y-3.5 pt-1">
            {buildingDemands.map((item, idx) => {
              const colors = [
                "bg-emerald-600",
                "bg-[#1B365D]",
                "bg-amber-600",
                "bg-indigo-600",
                "bg-rose-600",
              ];
              const barColor = colors[idx % colors.length];

              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-800">{item.name}</span>
                    <span className="text-gray-600">
                      <strong>{item.count}</strong> ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
