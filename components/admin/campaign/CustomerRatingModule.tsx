"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CampaignCustomer } from "@prisma/client";

export type SerializedCampaignCustomer = Omit<CampaignCustomer, "checkinDate" | "checkoutDate" | "stayAmount" | "nightRate" | "createdAt" | "updatedAt"> & {
  checkinDate: string | null;
  checkoutDate: string | null;
  stayAmount: number | null;
  nightRate: number | null;
  createdAt: string;
  updatedAt: string;
  conversationId?: string | null;
};

type Props = {
  initialCustomers: SerializedCampaignCustomer[];
  locale: string;
};

export default function CustomerRatingModule({ initialCustomers, locale }: Props) {
  const isEn = locale === "en";
  const router = useRouter();

  const [customers, setCustomers] = useState<SerializedCampaignCustomer[]>(initialCustomers);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterBuilding, setFilterBuilding] = useState<string>("ALL");
  const [filterSubject, setFilterSubject] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/campaign/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert(isEn ? `Successfully imported ${data.count} customers!` : `تم استيراد ${data.count} عميل بنجاح!`);
        router.refresh(); // Refresh the server component to get new data
      } else {
        alert(isEn ? `Error: ${data.error}` : `خطأ: ${data.error}`);
      }
    } catch (err) {
      alert(isEn ? "An unexpected error occurred" : "حدث خطأ غير متوقع");
    } finally {
      setIsUploading(false);
      // clear the file input
      e.target.value = "";
    }
  };

  const uniqueBuildings = Array.from(new Set(customers.map(c => c.building).filter(Boolean))) as string[];
  const uniqueSubjects = Array.from(new Set(customers.flatMap(c => c.subjects || [])));

  const filteredCustomers = customers.filter(c => {
    if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
    if (filterBuilding !== "ALL" && c.building !== filterBuilding) return false;
    if (filterSubject !== "ALL" && !(c.subjects || []).includes(filterSubject)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.phone.includes(q) && !(c.building?.toLowerCase() || "").includes(q)) {
        return false;
      }
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-gray-100 text-gray-800";
      case "SENT_WAITING": return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS": return "bg-yellow-100 text-yellow-800";
      case "DONE": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const [sendProgress, setSendProgress] = useState<{current: number, total: number} | null>(null);

  const handleSendSurvey = async () => {
    if (selectedIds.size === 0) return;
    
    const confirmMsg = isEn 
      ? `Are you sure you want to send the WhatsApp survey to ${selectedIds.size} customers?`
      : `هل أنت متأكد أنك تريد إرسال استبيان الواتساب إلى ${selectedIds.size} عملاء؟`;
      
    if (!confirm(confirmMsg)) return;

    setIsSending(true);
    const allIds = Array.from(selectedIds);
    setSendProgress({ current: 0, total: allIds.length });
    let successCount = 0;
    
    try {
      const chunkSize = 100;
      
      for (let i = 0; i < allIds.length; i += chunkSize) {
        const chunk = allIds.slice(i, i + chunkSize);
        
        const res = await fetch("/api/admin/campaign/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerIds: chunk }),
        });

        const data = await res.json();
        
        if (res.ok) {
          successCount += data.count;
          // Update the UI immediately for this chunk
          setCustomers(prev => prev.map(c => 
            chunk.includes(c.id) ? { ...c, status: "SENT_WAITING" } : c
          ));
          setSendProgress({ current: Math.min(i + chunkSize, allIds.length), total: allIds.length });
        } else {
          console.error("Error sending chunk:", data.error);
          alert(isEn ? `Error on batch ${Math.floor(i/chunkSize) + 1}: ${data.error}` : `خطأ في الدفعة ${Math.floor(i/chunkSize) + 1}: ${data.error}`);
          // Decide whether to break or continue on error. Continuing might be better so rest of batches go through.
        }
      }

      setSelectedIds(new Set());
      alert(isEn ? `Successfully sent ${successCount} surveys!` : `تم إرسال ${successCount} استبيان بنجاح!`);
    } catch (err) {
      console.error(err);
      alert(isEn ? "An unexpected error occurred." : "حدث خطأ غير متوقع.");
    } finally {
      setIsSending(false);
      setSendProgress(null);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4">
        
        {/* Filters & Bulk Actions */}
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder={isEn ? "Search name, phone..." : "بحث بالاسم، الهاتف..."}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-nassayem outline-none w-48 sm:w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-nassayem outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">{isEn ? "All Statuses" : "كل الحالات"}</option>
            <option value="PENDING">{isEn ? "Pending" : "قيد الانتظار"}</option>
            <option value="SENT_WAITING">{isEn ? "Sent & Waiting" : "تم الإرسال وبانتظار الرد"}</option>
            <option value="IN_PROGRESS">{isEn ? "In Progress" : "جاري المعالجة"}</option>
            <option value="DONE">{isEn ? "Done" : "مكتمل"}</option>
          </select>

          <select
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-nassayem outline-none"
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
          >
            <option value="ALL">{isEn ? "All Buildings" : "كل المباني"}</option>
            {uniqueBuildings.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-nassayem outline-none"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            <option value="ALL">{isEn ? "All Subjects" : "كل المواضيع"}</option>
            {uniqueSubjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          
          {selectedIds.size > 0 && (
            <button
              onClick={handleSendSurvey}
              disabled={isSending}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              {isSending ? (
                <span className="animate-pulse">
                  {isEn 
                    ? (sendProgress ? `Sending (${sendProgress.current}/${sendProgress.total})...` : "Sending...") 
                    : (sendProgress ? `جاري الإرسال (${sendProgress.current}/${sendProgress.total})...` : "جاري الإرسال...")}
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {isEn ? `Send Survey (${selectedIds.size})` : `إرسال الاستبيان (${selectedIds.size})`}
                </>
              )}
            </button>
          )}
        </div>

        {/* Upload Action */}
        <div className="flex gap-2">
          <label className="bg-nassayem text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-nassayem-dark cursor-pointer flex items-center gap-2 transition-colors">
            {isUploading ? (
              <span className="animate-pulse">{isEn ? "Uploading..." : "جاري الرفع..."}</span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isEn ? "Import CSV" : "استيراد CSV"}
              </>
            )}
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-500">
          <thead className="bg-gray-50 text-gray-700 uppercase">
            <tr>
              <th className="px-4 py-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-nassayem focus:ring-nassayem"
                  checked={filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-6 py-4">{isEn ? "Customer" : "العميل"}</th>
              <th className="px-6 py-4">{isEn ? "Stay Info" : "معلومات الإقامة"}</th>
              <th className="px-6 py-4">{isEn ? "Status" : "الحالة"}</th>
              <th className="px-6 py-4">{isEn ? "Feedback Summary" : "ملخص التقييم"}</th>
              <th className="px-6 py-4 text-center">{isEn ? "Actions" : "إجراءات"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  {isEn ? "No customers found. Please import a CSV to start." : "لا يوجد عملاء. يرجى استيراد ملف CSV للبدء."}
                </td>
              </tr>
            ) : (
              filteredCustomers.map(customer => (
                <tr key={customer.id} className={`hover:bg-gray-50 ${selectedIds.has(customer.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-4 py-4 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-nassayem focus:ring-nassayem"
                      checked={selectedIds.has(customer.id)}
                      onChange={() => toggleSelection(customer.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-gray-500" dir="ltr">{customer.phone}</div>
                    {customer.reservationNumber && (
                      <div className="text-xs text-gray-400 mt-1">Res: {customer.reservationNumber}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{customer.building || "N/A"} - {customer.unitNumber || "N/A"}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {customer.checkinDate ? new Date(customer.checkinDate).toLocaleDateString() : ""} 
                      {" → "} 
                      {customer.checkoutDate ? new Date(customer.checkoutDate).toLocaleDateString() : ""}
                    </div>
                    {(customer.stayAmount != null || customer.nightRate != null) && (
                      <div className="text-xs font-medium text-gray-600 mt-1">
                        {customer.stayAmount != null && <span>Total: {customer.stayAmount} OMR</span>}
                        {customer.stayAmount != null && customer.nightRate != null && <span className="mx-1">•</span>}
                        {customer.nightRate != null && <span>Rate: {customer.nightRate} OMR/night</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    {customer.summary ? (
                      <div>
                        <div className="text-gray-900 font-medium whitespace-pre-wrap">{customer.summary}</div>
                        {customer.category && (
                          <span className="inline-block mt-1 mr-1 bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded">
                            {customer.category}
                          </span>
                        )}
                        {customer.subjects && customer.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {customer.subjects.map((subject, idx) => (
                              <span key={idx} className="inline-block bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded">
                                {subject}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">{isEn ? "No feedback yet" : "لا يوجد تقييم بعد"}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center space-x-2">
                    {/* Link to view Chatbot Conversation based on Phone Number */}
                    {customer.conversationId ? (
                      <button 
                        className="text-nassayem hover:underline font-medium"
                        onClick={() => router.push(`/${locale}/admin/chatbot/conversations/${customer.conversationId}`)}
                      >
                        {isEn ? "View Chat" : "عرض المحادثة"}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">{isEn ? "No Chat Yet" : "لا يوجد محادثة"}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
