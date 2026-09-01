"use client";

import { MapPin, Activity, Wrench, FileText, User, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  equipment: any;
  locale: string;
  currentUserRole: string;
};

export default function EquipmentDetail({
  equipment,
  locale,
  currentUserRole,
}: Props) {
  const isEn = locale === "en";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "WORKING":
        return "bg-green-100 text-green-800";
      case "NEEDS_REPAIR":
        return "bg-red-100 text-red-800";
      case "IN_MAINTENANCE":
        return "bg-orange-100 text-orange-800";
      case "RETIRED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getVisitStatusColor = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "text-green-600 bg-green-50";
      case "NEEDS_PARTS":
        return "text-orange-600 bg-orange-50";
      case "UNRESOLVED":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 print:hidden">
        <div>
          <Link
            href={`/${locale}/admin/maintenance/equipment`}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {isEn ? "Back to Directory" : "العودة للدليل"}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEn ? "Equipment Profile" : "ملف الجهاز"}
          </h1>
        </div>
        
        <button
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
        >
          <Printer className="w-4 h-4" />
          {isEn ? "Print QR" : "طباعة رمز QR"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & QR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 text-center border-b border-gray-100 bg-gray-50/50">
              <div className="inline-block bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 print:shadow-none print:border-none">
                <QRCodeSVG
                  value={equipment.qrCode}
                  size={160}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <h2 className="font-mono text-lg font-semibold text-gray-900">
                {equipment.qrCode}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isEn ? "Scan to log a visit" : "امسح لتسجيل زيارة"}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {isEn ? "Type" : "النوع"}
                </div>
                <div className="font-medium text-gray-900">{isEn ? equipment.type?.nameEn || equipment.type?.nameAr : equipment.type?.nameAr}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {isEn ? "Brand / Model" : "الماركة / الموديل"}
                </div>
                <div className="text-gray-900">{equipment.brandModel}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {isEn ? "Location" : "الموقع"}
                </div>
                <div className="flex items-center gap-1.5 text-gray-900">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{isEn ? equipment.building.nameEn : equipment.building.nameAr}</span>
                </div>
                {equipment.unitNumber && (
                  <div className="text-sm text-gray-600 mt-1 ml-5">
                    {isEn ? "Unit: " : "شقة: "} {equipment.unitNumber}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {isEn ? "Status" : "الحالة"}
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(equipment.status)}`}>
                  {equipment.status.replace("_", " ")}
                </span>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {isEn ? "Registered On" : "تاريخ التسجيل"}
                </div>
                <div className="text-gray-900">
                  {format(new Date(equipment.createdAt), "PPP")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visits Timeline */}
        <div className="lg:col-span-2 space-y-6 print:hidden">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              {isEn ? "Maintenance History" : "سجل الصيانة"}
            </h3>

            {equipment.visits.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Wrench className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p>{isEn ? "No maintenance visits recorded yet." : "لم يتم تسجيل أي زيارات صيانة بعد."}</p>
              </div>
            ) : (
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                {equipment.visits.map((visit: any, index: number) => (
                  <div key={visit.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    
                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10">
                      <Wrench className="w-4 h-4" />
                    </div>
                    
                    {/* Card */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-gray-900">
                          {format(new Date(visit.visitDate), "MMM d, yyyy")}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getVisitStatusColor(visit.status)}`}>
                          {visit.status.replace("_", " ")}
                        </span>
                      </div>
                      
                      <div className="space-y-3 mt-3">
                        <div>
                          <div className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
                            <FileText className="w-3 h-3" />
                            {isEn ? "Issue" : "المشكلة"}
                          </div>
                          <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded-lg">
                            {visit.issueDescription}
                          </p>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
                            <Wrench className="w-3 h-3" />
                            {isEn ? "Action Taken" : "الإجراء المتخذ"}
                          </div>
                          <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded-lg">
                            {visit.actionTaken}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-medium text-gray-600">
                            {visit.technician?.name || visit.technician?.email}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
