"use client";

import { useState } from "react";
import type { UnitType } from "@prisma/client";
import { createBuildingUnit, updateBuildingUnit, deleteBuildingUnit } from "@/app/actions/buildingUnits";

const UNIT_TYPE_CONFIG: Record<string, { labelEn: string; labelAr: string; bg: string; text: string }> = {
  STUDIO: { labelEn: "Studio", labelAr: "استوديو", bg: "bg-purple-50", text: "text-purple-700" },
  ONE_BEDROOM: { labelEn: "1 Bedroom", labelAr: "غرفة وصالة", bg: "bg-blue-50", text: "text-blue-700" },
  TWO_BEDROOM: { labelEn: "2 Bedrooms", labelAr: "غرفتين وصالة", bg: "bg-green-50", text: "text-green-700" },
  THREE_BEDROOM: { labelEn: "3 Bedrooms", labelAr: "ثلاث غرف وصالة", bg: "bg-orange-50", text: "text-orange-700" },
  VILLA: { labelEn: "Villa", labelAr: "فيلا", bg: "bg-pink-50", text: "text-pink-700" },
};

type BuildingUnit = {
  id: string;
  name: string;
  netsuiteId: string | null;
  type: UnitType | null;
  _count: { tasks: number };
};

type Props = {
  buildingId: string;
  units: BuildingUnit[];
  locale: string;
};

export default function BuildingUnitsManager({ buildingId, units, locale }: Props) {
  const isEn = locale === "en";
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{name: string; netsuiteId: string; type: UnitType | ""}>({
    name: "", netsuiteId: "", type: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setFormData({ name: "", netsuiteId: "", type: "" });
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  }

  function startEdit(unit: BuildingUnit) {
    setFormData({
      name: unit.name,
      netsuiteId: unit.netsuiteId || "",
      type: unit.type || "",
    });
    setEditingId(unit.id);
    setIsAdding(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: formData.name,
      netsuiteId: formData.netsuiteId || undefined,
      type: formData.type || null,
    };

    let res;
    if (editingId) {
      res = await updateBuildingUnit(editingId, buildingId, payload);
    } else {
      res = await createBuildingUnit(buildingId, payload);
    }

    if (res.error) {
      setError(res.error);
    } else {
      resetForm();
    }
    setLoading(false);
  }

  async function handleDelete(unit: BuildingUnit) {
    if (unit._count.tasks > 0) {
      alert(isEn ? `Cannot delete because this unit has ${unit._count.tasks} connected tasks.` : `لا يمكن الحذف لأن هذه الوحدة مرتبطة بـ ${unit._count.tasks} مهام.`);
      return;
    }
    if (!confirm(isEn ? "Are you sure you want to delete this unit?" : "هل أنت متأكد من حذف هذه الوحدة؟")) return;
    
    setLoading(true);
    const res = await deleteBuildingUnit(unit.id, buildingId);
    if (res.error) {
      alert(res.error);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          {isEn ? "Operational Units" : "الوحدات التشغيلية"}
        </h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-nassayem text-white text-sm font-medium rounded-xl hover:bg-nassayem/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {isEn ? "Add Unit" : "إضافة وحدة"}
          </button>
        )}
      </div>

      {/* Form Modal/Inline */}
      {isAdding && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? (isEn ? "Edit Unit" : "تعديل وحدة") : (isEn ? "Add New Unit" : "إضافة وحدة جديدة")}
          </h3>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isEn ? "Unit Name / Number" : "اسم/رقم الوحدة"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. 101, Villa 5"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isEn ? "Netsuite ID" : "معرف نتسويت"}
                </label>
                <input
                  type="text"
                  value={formData.netsuiteId}
                  onChange={e => setFormData({ ...formData, netsuiteId: e.target.value })}
                  placeholder="e.g. UNT-001"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isEn ? "Unit Type" : "نوع الوحدة"}
                </label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 bg-white"
                >
                  <option value="">{isEn ? "Select type..." : "اختر النوع..."}</option>
                  {(Object.entries(UNIT_TYPE_CONFIG) as [string, any][]).map(([key, conf]) => (
                    <option key={key} value={key}>{isEn ? conf.labelEn : conf.labelAr}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                {isEn ? "Cancel" : "إلغاء"}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-nassayem text-white text-sm font-medium rounded-xl hover:bg-nassayem/90 disabled:opacity-50"
              >
                {loading ? (isEn ? "Saving..." : "جاري الحفظ...") : (isEn ? "Save Unit" : "حفظ الوحدة")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {units.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {isEn ? "No units added yet." : "لم يتم إضافة وحدات بعد."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
                <tr>
                  <th className="px-5 py-3 text-start">{isEn ? "Unit Name" : "اسم الوحدة"}</th>
                  <th className="px-5 py-3 text-start">{isEn ? "Netsuite ID" : "معرف نتسويت"}</th>
                  <th className="px-5 py-3 text-start">{isEn ? "Type" : "النوع"}</th>
                  <th className="px-5 py-3 text-start">{isEn ? "Connected Tasks" : "المهام المرتبطة"}</th>
                  <th className="px-5 py-3 text-end">{isEn ? "Actions" : "الإجراءات"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {units.map((unit) => {
                  const typeConf = unit.type ? UNIT_TYPE_CONFIG[unit.type] : null;
                  return (
                    <tr key={unit.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">{unit.name}</td>
                      <td className="px-5 py-3 text-gray-500">{unit.netsuiteId || "—"}</td>
                      <td className="px-5 py-3">
                        {typeConf ? (
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${typeConf.bg} ${typeConf.text}`}>
                            {isEn ? typeConf.labelEn : typeConf.labelAr}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {unit._count.tasks}
                      </td>
                      <td className="px-5 py-3 flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(unit)}
                          disabled={loading}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          title={isEn ? "Edit" : "تعديل"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(unit)}
                          disabled={loading || unit._count.tasks > 0}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title={isEn ? "Delete" : "حذف"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
