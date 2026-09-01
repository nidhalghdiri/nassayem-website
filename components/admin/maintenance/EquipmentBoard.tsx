"use client";

import { useState } from "react";
import { Search, MapPin, Activity, Wrench, MoreVertical, Plus } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

import { createEquipmentType, createEquipment } from "@/app/actions/maintenance";
import { Loader2, Settings, Plus, Activity, X } from "lucide-react";

type Props = {
  equipments: any[];
  equipmentTypes: any[];
  buildings: any[];
  locale: string;
  currentUserRole: string;
};

export default function EquipmentBoard({
  equipments,
  equipmentTypes,
  buildings,
  locale,
  currentUserRole,
}: Props) {
  const isEn = locale === "en";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");

  const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);
  const [newTypeNameAr, setNewTypeNameAr] = useState("");
  const [newTypeNameEn, setNewTypeNameEn] = useState("");
  const [isSubmittingType, setIsSubmittingType] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingEq, setIsAddingEq] = useState(false);
  const [addForm, setAddForm] = useState({
    qrCode: "",
    buildingId: "",
    unitNumber: "",
    typeId: "",
    brandModel: "",
  });

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeNameAr.trim()) return;
    setIsSubmittingType(true);
    try {
      await createEquipmentType({
        nameAr: newTypeNameAr.trim(),
        nameEn: newTypeNameEn.trim() || undefined,
      });
      setNewTypeNameAr("");
      setNewTypeNameEn("");
      setIsTypesModalOpen(false);
    } catch (err) {
      alert(isEn ? "Failed to add type" : "حدث خطأ أثناء إضافة النوع");
    } finally {
      setIsSubmittingType(false);
    }
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.qrCode || !addForm.buildingId || !addForm.typeId) return;
    
    setIsAddingEq(true);
    try {
      await createEquipment({
        qrCode: addForm.qrCode,
        buildingId: addForm.buildingId,
        unitNumber: addForm.unitNumber || undefined,
        typeId: addForm.typeId,
        brandModel: addForm.brandModel,
      });
      setIsAddModalOpen(false);
      setAddForm({ qrCode: "", buildingId: "", unitNumber: "", typeId: "", brandModel: "" });
      alert(isEn ? "Equipment added successfully!" : "تمت إضافة الجهاز بنجاح!");
      // Note: Revalidation handles refreshing the list
    } catch (err) {
      alert(isEn ? "Failed to add equipment. QR Code might already exist." : "فشلت الإضافة. قد يكون رمز QR موجوداً بالفعل.");
    } finally {
      setIsAddingEq(false);
    }
  };

  const filteredEquipments = equipments.filter((eq) => {
    if (search && !eq.qrCode.includes(search) && !eq.brandModel.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter && eq.status !== statusFilter) return false;
    if (buildingFilter && eq.buildingId !== buildingFilter) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "GOOD":
        return "bg-green-100 text-green-800";
      case "FAIR":
        return "bg-blue-100 text-blue-800";
      case "NEEDS_REPAIR":
        return "bg-orange-100 text-orange-800";
      case "NEEDS_REPLACEMENT":
        return "bg-red-100 text-red-800";
      case "BROKEN":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEn ? "Equipment Directory" : "دليل المعدات والأجهزة"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEn
              ? "Manage and track all building equipment"
              : "إدارة وتتبع جميع الأجهزة في المباني"}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsTypesModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            {isEn ? "Manage Types" : "إدارة الأنواع"}
          </button>
          <Link
            href={`/${locale}/admin/maintenance/scan`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Activity className="w-4 h-4" />
            {isEn ? "Technician Scan" : "مسح الفني"}
          </Link>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isEn ? "Add Equipment" : "إضافة جهاز"}
          </button>
        </div>
      </div>

      {/* Stats/Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{equipments.length}</div>
            <div className="text-sm text-gray-500">{isEn ? "Total Equipment" : "إجمالي الأجهزة"}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {equipments.filter(e => e.status === "NEEDS_REPAIR").length}
            </div>
            <div className="text-sm text-gray-500">{isEn ? "Needs Repair" : "يحتاج صيانة"}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute ${isEn ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
          <input
            type="text"
            placeholder={isEn ? "Search QR or Brand..." : "ابحث برمز QR أو الماركة..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${isEn ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{isEn ? "All Statuses" : "جميع الحالات"}</option>
          <option value="GOOD">{isEn ? "Good" : "جيد"}</option>
          <option value="FAIR">{isEn ? "Fair" : "متوسط"}</option>
          <option value="NEEDS_REPAIR">{isEn ? "Needs Repair" : "يحتاج صيانة"}</option>
          <option value="NEEDS_REPLACEMENT">{isEn ? "Needs Replacement" : "يحتاج استبدال"}</option>
          <option value="BROKEN">{isEn ? "Broken" : "معطل"}</option>
        </select>
        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{isEn ? "All Buildings" : "جميع المباني"}</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {isEn ? b.nameEn : b.nameAr}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">{isEn ? "QR Code" : "رمز QR"}</th>
                <th className="px-6 py-4">{isEn ? "Equipment" : "الجهاز"}</th>
                <th className="px-6 py-4">{isEn ? "Location" : "الموقع"}</th>
                <th className="px-6 py-4">{isEn ? "Status" : "الحالة"}</th>
                <th className="px-6 py-4">{isEn ? "Last Visit" : "آخر زيارة"}</th>
                <th className="px-6 py-4 text-center">{isEn ? "Visits" : "الزيارات"}</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEquipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {isEn ? "No equipment found matching your criteria." : "لم يتم العثور على أجهزة تطابق بحثك."}
                  </td>
                </tr>
              ) : (
                filteredEquipments.map((eq) => (
                  <tr key={eq.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-gray-900">{eq.qrCode}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{isEn ? eq.type?.nameEn || eq.type?.nameAr : eq.type?.nameAr}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{eq.brandModel}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-gray-900">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{isEn ? eq.building.nameEn : eq.building.nameAr}</span>
                      </div>
                      {eq.unitNumber && (
                        <div className="text-gray-500 text-xs mt-0.5 ml-5">
                          {isEn ? "Unit: " : "شقة: "} {eq.unitNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(eq.status)}`}>
                        {eq.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {eq.visits.length > 0
                        ? format(new Date(eq.visits[0].visitDate), "MMM d, yyyy")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                        {eq._count.visits}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/${locale}/admin/maintenance/equipment/${eq.id}`}
                        className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Types Modal */}
      {isTypesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">
                {isEn ? "Manage Equipment Types" : "إدارة أنواع الأجهزة"}
              </h2>
              <button
                onClick={() => setIsTypesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">
                  {isEn ? "Current Types" : "الأنواع الحالية"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {equipmentTypes.map((type) => (
                    <span key={type.id} className="px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-sm text-gray-700">
                      {isEn ? type.nameEn || type.nameAr : type.nameAr}
                    </span>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddType} className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 uppercase">
                  {isEn ? "Add New Type" : "إضافة نوع جديد"}
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEn ? "Type Name (Arabic)" : "اسم النوع (عربي)"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTypeNameAr}
                    onChange={(e) => setNewTypeNameAr(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-right"
                    placeholder="مثال: مكيف نافذة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEn ? "Type Name (English)" : "اسم النوع (إنجليزي)"}
                  </label>
                  <input
                    type="text"
                    value={newTypeNameEn}
                    onChange={(e) => setNewTypeNameEn(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-left"
                    placeholder="e.g. Window AC"
                    dir="ltr"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingType}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isSubmittingType ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEn ? "Add Type" : "إضافة النوع")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col mt-10 mb-10">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">
                {isEn ? "Add New Equipment" : "إضافة جهاز جديد"}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 flex-1">
              <form onSubmit={handleAddEquipment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEn ? "QR Code ID" : "معرف QR"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.qrCode}
                    onChange={(e) => setAddForm({ ...addForm, qrCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-center uppercase"
                    placeholder="e.g. AC-101"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEn ? "Building" : "المبنى"} *
                  </label>
                  <select
                    required
                    value={addForm.buildingId}
                    onChange={(e) => setAddForm({ ...addForm, buildingId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{isEn ? "Select Building" : "اختر المبنى"}</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {isEn ? b.nameEn : b.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEn ? "Unit Number" : "رقم الشقة / الوحدة"}
                  </label>
                  <input
                    type="text"
                    value={addForm.unitNumber}
                    onChange={(e) => setAddForm({ ...addForm, unitNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEn ? "Equipment Type" : "نوع الجهاز"} *
                  </label>
                  <select
                    required
                    value={addForm.typeId}
                    onChange={(e) => setAddForm({ ...addForm, typeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{isEn ? "Select Type" : "اختر النوع"}</option>
                    {equipmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {isEn ? t.nameEn || t.nameAr : t.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEn ? "Brand / Model" : "الماركة / الموديل"}
                  </label>
                  <input
                    type="text"
                    value={addForm.brandModel}
                    onChange={(e) => setAddForm({ ...addForm, brandModel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isAddingEq}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAddingEq ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <Plus className="w-4 h-4" />
                        {isEn ? "Save Equipment" : "حفظ الجهاز"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
