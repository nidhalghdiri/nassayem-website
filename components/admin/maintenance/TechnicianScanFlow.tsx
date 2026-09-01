"use client";

import { useState } from "react";
import { Search, Loader2, Wrench, CheckCircle2 } from "lucide-react";
import { getEquipmentByQrCode, logMaintenanceVisit } from "@/app/actions/maintenance";
import { EquipmentVisitStatus } from "@prisma/client";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

type Props = {
  locale: string;
  currentUserId: string;
};

export default function TechnicianScanFlow({ locale, currentUserId }: Props) {
  const isEn = locale === "en";
  const router = useRouter();

  const [qrCode, setQrCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [equipment, setEquipment] = useState<any | null>(null);
  const [searchError, setSearchError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    issueDescription: "",
    actionTaken: "",
    status: "RESOLVED" as EquipmentVisitStatus,
  });
  const [success, setSuccess] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCode.trim()) return;

    setIsSearching(true);
    setSearchError("");
    setEquipment(null);
    setSuccess(false);

    try {
      const eq = await getEquipmentByQrCode(qrCode.trim());
      if (eq) {
        setEquipment(eq);
      } else {
        setSearchError(isEn ? "Equipment not found" : "لم يتم العثور على الجهاز");
      }
    } catch (error) {
      setSearchError(isEn ? "Error searching for equipment" : "حدث خطأ أثناء البحث");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment || !form.issueDescription || !form.actionTaken) return;

    setIsSubmitting(true);
    try {
      await logMaintenanceVisit({
        equipmentId: equipment.id,
        technicianId: currentUserId,
        issueDescription: form.issueDescription,
        actionTaken: form.actionTaken,
        status: form.status,
      });
      setSuccess(true);
      // Reset form
      setForm({ issueDescription: "", actionTaken: "", status: "RESOLVED" });
    } catch (error) {
      alert(isEn ? "Failed to log visit" : "فشل تسجيل الزيارة");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6 min-h-screen">
      <div className="text-center space-y-2 mb-8">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Search className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEn ? "Technician Scan" : "بحث الفني"}
        </h1>
        <p className="text-sm text-gray-500">
          {isEn 
            ? "Enter or scan the equipment QR code to log a visit" 
            : "أدخل أو امسح رمز QR الخاص بالجهاز لتسجيل زيارة"}
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={qrCode}
          onChange={(e) => setQrCode(e.target.value)}
          placeholder={isEn ? "Enter QR Code (e.g. AC-101)..." : "أدخل رمز QR (مثل AC-101)..."}
          className="w-full text-lg p-4 pl-12 pr-24 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center uppercase"
          autoFocus
        />
        <button
          type="submit"
          disabled={isSearching || !qrCode.trim()}
          className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEn ? "Find" : "بحث")}
        </button>
      </form>

      {searchError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm font-medium">
          {searchError}
        </div>
      )}

      {equipment && !success && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-gray-50 border-b border-gray-200 p-4">
            <h2 className="font-bold text-gray-900 flex justify-between items-center">
              <span>{isEn ? equipment.type?.nameEn || equipment.type?.nameAr : equipment.type?.nameAr} - {equipment.brandModel}</span>
              <span className="font-mono text-sm px-2 py-1 bg-white rounded-md border border-gray-200 text-gray-600">
                {equipment.qrCode}
              </span>
            </h2>
            <div className="text-sm text-gray-500 mt-1">
              {isEn ? equipment.building.nameEn : equipment.building.nameAr}
              {equipment.unitNumber && ` • Unit ${equipment.unitNumber}`}
            </div>
          </div>

          <form onSubmit={handleSubmitVisit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEn ? "Issue Description" : "وصف المشكلة"}
              </label>
              <textarea
                required
                value={form.issueDescription}
                onChange={(e) => setForm({ ...form, issueDescription: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                placeholder={isEn ? "What was reported?" : "ما هو العطل المبلغ عنه؟"}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEn ? "Action Taken" : "الإجراء المتخذ"}
              </label>
              <textarea
                required
                value={form.actionTaken}
                onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                placeholder={isEn ? "What did you do?" : "ماذا فعلت لإصلاح العطل؟"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEn ? "Status" : "حالة الإصلاح"}
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as EquipmentVisitStatus })}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="RESOLVED">{isEn ? "Fixed / Resolved" : "تم الإصلاح"}</option>
                <option value="NEEDS_PARTS">{isEn ? "Needs Parts" : "يحتاج قطع غيار"}</option>
                <option value="UNRESOLVED">{isEn ? "Unresolved / Cannot Fix" : "لم يتم الإصلاح"}</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Wrench className="w-5 h-5" />
                  {isEn ? "Log Maintenance Visit" : "تسجيل الزيارة"}
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-4 animate-in zoom-in-95">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-green-900">
            {isEn ? "Visit Logged Successfully!" : "تم تسجيل الزيارة بنجاح!"}
          </h2>
          <button
            onClick={() => {
              setQrCode("");
              setEquipment(null);
              setSuccess(false);
            }}
            className="px-6 py-2 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
          >
            {isEn ? "Scan Another Device" : "فحص جهاز آخر"}
          </button>
        </div>
      )}
    </div>
  );
}
