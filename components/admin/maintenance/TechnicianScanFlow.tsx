"use client";

import { useState } from "react";
import { Search, Loader2, Wrench, CheckCircle2, Camera, X } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { getEquipmentByQrCode, logMaintenanceVisit } from "@/app/actions/maintenance";
import { EquipmentVisitStatus } from "@prisma/client";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

type Props = {
  locale: string;
  currentUserId: string;
  buildings: any[];
  equipments: any[];
};

export default function TechnicianScanFlow({ locale, currentUserId, buildings, equipments }: Props) {
  const isEn = locale === "en";
  const router = useRouter();

  const [qrCode, setQrCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [equipment, setEquipment] = useState<any | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr");
  
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    issueDescription: "",
    customIssueDescription: "",
    actionTaken: "",
    customActionTaken: "",
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

  const handleCameraScan = async (detectedQr: string) => {
    if (!detectedQr) return;
    setIsCameraOpen(false);
    setQrCode(detectedQr);
    
    // Auto-search
    setIsSearching(true);
    setSearchError("");
    setEquipment(null);
    setSuccess(false);

    try {
      const eq = await getEquipmentByQrCode(detectedQr.trim());
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

  const handleManualEquipmentChange = async (eqId: string) => {
    setSelectedEquipmentId(eqId);
    if (!eqId) return;

    const eq = equipments.find(e => e.id === eqId);
    if (eq) {
      setQrCode(eq.qrCode);
      setIsSearching(true);
      setSearchError("");
      setEquipment(null);
      setSuccess(false);

      try {
        const fullEq = await getEquipmentByQrCode(eq.qrCode);
        if (fullEq) setEquipment(fullEq);
        else setSearchError(isEn ? "Equipment not found" : "لم يتم العثور على الجهاز");
      } catch (error) {
        setSearchError(isEn ? "Error searching for equipment" : "حدث خطأ أثناء البحث");
      } finally {
        setIsSearching(false);
      }
    }
  };

  const buildingEquipments = equipments.filter(eq => eq.buildingId === selectedBuildingId);
  const uniqueUnits = Array.from(new Set(buildingEquipments.map(eq => eq.unitNumber).filter(Boolean))) as string[];
  const unitEquipments = buildingEquipments.filter(eq => selectedUnit ? eq.unitNumber === selectedUnit : true);

  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalIssue = (form.issueDescription === "Other" || form.issueDescription === "أخرى") ? form.customIssueDescription : form.issueDescription;
    const finalAction = (form.actionTaken === "Other" || form.actionTaken === "أخرى") ? form.customActionTaken : form.actionTaken;

    if (!equipment || !finalIssue || !finalAction) return;

    setIsSubmitting(true);
    try {
      await logMaintenanceVisit({
        equipmentId: equipment.id,
        technicianId: currentUserId,
        issueDescription: finalIssue,
        actionTaken: finalAction,
        status: form.status,
      });
      setSuccess(true);
      // Reset form
      setForm({ issueDescription: "", customIssueDescription: "", actionTaken: "", customActionTaken: "", status: "RESOLVED" });
    } catch (error) {
      alert(isEn ? "Failed to log visit" : "فشل تسجيل الزيارة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const issueOptionsEn = ["Not Cooling/Heating", "Leaking", "No Power / Won't Turn On", "Unusual Noise", "Physical Damage", "Routine Maintenance Required", "Other"];
  const issueOptionsAr = ["لا يبرد / لا يسخن", "تسريب", "لا يوجد طاقة / لا يعمل", "صوت غير طبيعي", "ضرر فيزيائي", "صيانة دورية مطلوبة", "أخرى"];

  const actionOptionsEn = ["Cleaned Filters/Components", "Replaced Parts", "To be checked by specialist", "Repaired", "Adjusted Settings", "Other"];
  const actionOptionsAr = ["تنظيف الفلاتر / القطع", "استبدال قطع الغيار", "بانتظار فحص متخصص", "تم الإصلاح", "تعديل الإعدادات", "أخرى"];

  return (
    <>
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

      {/* Toggle Scan Mode */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6 max-w-sm mx-auto">
        <button
          onClick={() => {
            setScanMode("qr");
            setEquipment(null);
            setSuccess(false);
          }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${scanMode === "qr" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {isEn ? "QR Scan" : "مسح QR"}
        </button>
        <button
          onClick={() => {
            setScanMode("manual");
            setEquipment(null);
            setSuccess(false);
          }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${scanMode === "manual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {isEn ? "Manual Select" : "اختيار يدوي"}
        </button>
      </div>

      {scanMode === "qr" ? (
        <form onSubmit={handleSearch} className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder={isEn ? "Enter QR Code (e.g. AC-101)..." : "أدخل رمز QR (مثل AC-101)..."}
              className="w-full text-lg p-4 pl-12 pr-12 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors p-2"
            >
              <Camera className="w-6 h-6" />
            </button>
          </div>
          <button
            type="submit"
            disabled={isSearching || !qrCode.trim()}
            className="px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium transition-colors disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEn ? "Find" : "بحث")}
          </button>
        </form>
      ) : (
        <div className="space-y-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEn ? "Building" : "المبنى"}
            </label>
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                setSelectedBuildingId(e.target.value);
                setSelectedUnit("");
                setSelectedEquipmentId("");
              }}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{isEn ? "Select Building" : "اختر المبنى"}</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{isEn ? b.nameEn : b.nameAr}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEn ? "Unit Number" : "رقم الشقة / الوحدة"}
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setSelectedEquipmentId("");
              }}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              disabled={!selectedBuildingId}
            >
              <option value="">{isEn ? "All Units" : "جميع الشقق"}</option>
              {uniqueUnits.map(u => (
                <option key={u} value={u}>{isEn ? "Unit" : "شقة"} {u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEn ? "Equipment" : "الجهاز"}
            </label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => handleManualEquipmentChange(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              disabled={!selectedBuildingId}
            >
              <option value="">{isEn ? "Select Equipment" : "اختر الجهاز"}</option>
              {unitEquipments.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.qrCode} - {isEn ? eq.type?.nameEn || eq.type?.nameAr : eq.type?.nameAr} ({eq.brandModel})
                </option>
              ))}
            </select>
          </div>
          
          {isSearching && (
            <div className="flex items-center gap-2 text-blue-600 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">{isEn ? "Loading equipment..." : "جاري تحميل الجهاز..."}</span>
            </div>
          )}
        </div>
      )}

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
              <select
                required
                value={form.issueDescription}
                onChange={(e) => setForm({ ...form, issueDescription: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 mb-2"
              >
                <option value="">{isEn ? "Select Issue" : "اختر المشكلة"}</option>
                {(isEn ? issueOptionsEn : issueOptionsAr).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {(form.issueDescription === "Other" || form.issueDescription === "أخرى") && (
                <textarea
                  required
                  value={form.customIssueDescription}
                  onChange={(e) => setForm({ ...form, customIssueDescription: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                  placeholder={isEn ? "Please describe the issue..." : "يرجى وصف المشكلة..."}
                />
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEn ? "Action Taken" : "الإجراء المتخذ"}
              </label>
              <select
                required
                value={form.actionTaken}
                onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 mb-2"
              >
                <option value="">{isEn ? "Select Action" : "اختر الإجراء"}</option>
                {(isEn ? actionOptionsEn : actionOptionsAr).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {(form.actionTaken === "Other" || form.actionTaken === "أخرى") && (
                <textarea
                  required
                  value={form.customActionTaken}
                  onChange={(e) => setForm({ ...form, customActionTaken: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                  placeholder={isEn ? "What did you do?" : "ماذا فعلت لإصلاح العطل؟"}
                />
              )}
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
      
      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <button
            onClick={() => setIsCameraOpen(false)}
            className="absolute top-6 right-6 z-10 text-white bg-black/50 p-2 rounded-full hover:bg-black/70"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="w-full max-w-md p-4">
            <h3 className="text-white text-center mb-4 font-medium">
              {isEn ? "Position QR Code in the frame" : "ضع رمز QR داخل الإطار"}
            </h3>
            <div className="rounded-2xl overflow-hidden border-2 border-gray-800">
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    handleCameraScan(result[0].rawValue);
                  }
                }}
                components={{
                  finder: true,
                }}
                styles={{
                  container: { width: "100%" },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
