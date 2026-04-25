"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { requestMaintenanceFromItem } from "@/app/actions/inspection";

// ── Types ────────────────────────────────────────────────────────────────────

type ChecklistItem = {
  id: string;
  category: string;
  label: string;
  status: string; // "pending" | "pass" | "fail" | "na"
  notes: string | null;
  severity: string | null;
  photoUrls: string[];
  displayOrder: number;
  maintenanceTaskId?: string | null;
};

type Checklist = {
  id: string;
  taskId: string;
  items: ChecklistItem[];
  overallRating: string | null;
  inspectorNotes: string | null;
  completedAt: string | null;
};

type Task = {
  id: string;
  title: string;
  unitNumber: string | null;
  building: { nameEn: string; nameAr: string } | null;
};

type Props = {
  task: Task;
  checklist: Checklist;
  locale: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const ITEM_STATUS_CLASSES: Record<string, string> = {
  pending: "border-gray-200 bg-white",
  pass:    "border-green-400 bg-green-50 shadow-sm",
  fail:    "border-red-400 bg-red-50 shadow-sm",
  na:      "border-gray-200 bg-gray-50 opacity-70",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function InspectionMode({ task, checklist: initial, locale }: Props) {
  const isEn = locale === "en";
  const router = useRouter();

  // ── Local state ──────────────────────────────────────────────────────────
  const [items, setItems] = useState<ChecklistItem[]>(initial.items);
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [inspectorNotes, setInspectorNotes] = useState(initial.inspectorNotes ?? "");
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photoUploading, setPhotoUploading] = useState<string | null>(null);
  const [requestingMaintenance, setRequestingMaintenance] = useState<string | null>(null);

  // Group items by category from the actual data
  const categories = Array.from(new Set(items.map((i) => i.category)));
  const activeCategory = categories[activeCatIdx];
  const categoryItems = items.filter((i) => i.category === activeCategory);

  // Progress counts
  const okCount = items.filter((i) => i.status === "pass").length;
  const notOkCount = items.filter((i) => i.status === "fail").length;
  const naCount = items.filter((i) => i.status === "na").length;
  const checkedCount = okCount + notOkCount + naCount;

  function showToast(msg: string, type: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // ── Item update ──────────────────────────────────────────────────────────

  const updateItemLocal = useCallback(
    (itemId: string, patch: Partial<ChecklistItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
      );
    },
    [],
  );

  async function patchItem(itemId: string, patch: Record<string, unknown>) {
    updateItemLocal(itemId, patch as Partial<ChecklistItem>);
    await fetch(`/api/tasks/${task.id}/checklist/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  function setItemStatus(itemId: string, status: string) {
    patchItem(itemId, { status });
  }

  async function handleMaintenanceRequest(item: ChecklistItem) {
    if (requestingMaintenance) return;
    setRequestingMaintenance(item.id);
    try {
      const res = await requestMaintenanceFromItem(task.id, item.id, item.label, item.notes, locale);
      if (res.success) {
        updateItemLocal(item.id, { maintenanceTaskId: res.maintenanceTaskId });
        showToast(isEn ? "Maintenance request created." : "تم إنشاء طلب صيانة.");
      }
    } catch (err) {
      showToast(isEn ? "Failed to create request." : "فشل إنشاء الطلب.", "error");
    } finally {
      setRequestingMaintenance(null);
    }
  }

  // ── Photo upload ─────────────────────────────────────────────────────────

  async function handleItemPhoto(e: React.ChangeEvent<HTMLInputElement>, itemId: string) {
    let file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(itemId);
    try {
      if (file.size > 1024 * 1024) {
        file = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1280, useWebWorker: true });
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("caption", `Inspection: ${items.find((i) => i.id === itemId)?.label ?? ""}`);
      const res = await fetch(`/api/tasks/${task.id}/photos`, { method: "POST", body: fd });
      if (res.ok) {
        const photo = await res.json();
        const item = items.find((i) => i.id === itemId);
        if (item) {
          const newUrls = [...item.photoUrls, photo.photoUrl as string];
          await patchItem(itemId, { photoUrls: newUrls });
        }
        showToast(isEn ? "Photo added." : "تمت إضافة الصورة.");
      }
    } finally {
      setPhotoUploading(null);
      e.target.value = "";
    }
  }

  // ── Complete inspection ──────────────────────────────────────────────────

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklist/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overallRating: null, inspectorNotes }),
      });
      if (res.ok) {
        showToast(isEn ? "Inspection finished!" : "تم إنهاء الفحص!");
        setTimeout(() => router.push(`/${locale}/admin/tasks?taskId=${task.id}`), 1000);
      }
    } finally {
      setCompleting(false);
    }
  }

  // ── Summary view ─────────────────────────────────────────────────────────
  if (showSummary) {
    const summaryItems = items.filter(i => i.status !== 'pending');
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <button onClick={() => setShowSummary(false)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">{isEn ? "Summary" : "الملخص"}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{task.title}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-2xl mx-auto w-full pb-20">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border-2 border-green-500 rounded-2xl p-5 shadow-sm">
              <p className="text-3xl font-black text-green-600">{okCount}</p>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                {isEn ? "OK Items" : "عناصر سليمة"}
              </p>
            </div>
            <div className="bg-white border-2 border-red-500 rounded-2xl p-5 shadow-sm">
              <p className="text-3xl font-black text-red-600">{notOkCount}</p>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                {isEn ? "Not OK Items" : "عناصر معطوبة"}
              </p>
            </div>
          </div>

          {/* Issues List */}
          {notOkCount > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                {isEn ? "Issues to Address" : "المشاكل المكتشفة"}
              </h2>
              {items.filter(i => i.status === 'fail').map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-red-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <p className="font-bold text-gray-800 text-sm">{item.label}</p>
                    {item.maintenanceTaskId && (
                      <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {isEn ? "Maintenance Task Created" : "تم إنشاء مهمة صيانة"}
                      </span>
                    )}
                  </div>
                  {item.notes && <p className="text-xs text-gray-500 mt-1 italic">"{item.notes}"</p>}
                </div>
              ))}
            </div>
          )}

          {/* Final Notes */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-gray-900">{isEn ? "Overall Notes" : "الملاحظات النهائية"}</h2>
            <textarea
              value={inspectorNotes}
              onChange={(e) => setInspectorNotes(e.target.value)}
              rows={4}
              placeholder={isEn ? "Add any final observations…" : "أضف أي ملاحظات ختامية…"}
              className="w-full px-4 py-3 text-sm border-2 border-gray-100 bg-white rounded-2xl focus:border-nassayem outline-none transition-all resize-none"
            />
          </div>

          {/* Finish Button */}
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full py-4 bg-gray-900 text-white font-black text-lg rounded-2xl hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {completing ? "..." : (isEn ? "Finish Inspection" : "إنهاء الفحص")}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── Checklist View ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl text-sm font-bold text-white transition-all ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push(`/${locale}/admin/tasks?taskId=${task.id}`)} className="p-2 bg-gray-50 rounded-xl text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-gray-900 truncate">{task.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">{okCount} OK</span>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">{notOkCount} NOT OK</span>
              </div>
            </div>
          </div>
          {checkedCount > 0 && (
            <button onClick={() => setShowSummary(true)} className="px-4 py-2 bg-nassayem text-white text-xs font-black rounded-xl shadow-lg shadow-nassayem/20 uppercase tracking-widest">
              {isEn ? "Review" : "مراجعة"}
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto scrollbar-hide">
        <div className="flex max-w-2xl mx-auto">
          {categories.map((cat, idx) => (
            <button
              key={cat}
              onClick={() => setActiveCatIdx(idx)}
              className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap border-b-4 transition-all ${
                idx === activeCatIdx ? "border-nassayem text-nassayem" : "border-transparent text-gray-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full pb-24">
        {categoryItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-3xl border-2 transition-all p-4 ${ITEM_STATUS_CLASSES[item.status]}`}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-bold text-gray-900 text-sm leading-tight">{item.label}</p>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setItemStatus(item.id, item.status === "pass" ? "pending" : "pass")}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${item.status === "pass" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                </button>
                <button
                  onClick={() => setItemStatus(item.id, item.status === "fail" ? "pending" : "fail")}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${item.status === "fail" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400"}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {item.status === "fail" && (
              <div className="mt-4 pt-4 border-t border-red-200 space-y-3">
                <textarea
                  value={item.notes ?? ""}
                  onChange={(e) => updateItemLocal(item.id, { notes: e.target.value })}
                  onBlur={(e) => patchItem(item.id, { notes: e.target.value })}
                  placeholder={isEn ? "Quick note about the issue…" : "ملاحظة سريعة حول المشكلة…"}
                  className="w-full bg-white border border-red-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-200 outline-none resize-none"
                  rows={2}
                />
                
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <label className="w-10 h-10 rounded-xl bg-white border border-red-100 flex items-center justify-center text-red-500 cursor-pointer">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleItemPhoto(e, item.id)} />
                    </label>
                    {item.photoUrls.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-10 h-10 rounded-xl object-cover border border-red-100" />
                    ))}
                  </div>

                  {item.maintenanceTaskId ? (
                    <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      Requested
                    </div>
                  ) : (
                    <button
                      onClick={() => handleMaintenanceRequest(item)}
                      disabled={requestingMaintenance === item.id}
                      className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-200 flex items-center gap-2"
                    >
                      {requestingMaintenance === item.id ? "..." : (isEn ? "Maintenance Needed" : "طلب صيانة")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Footer */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 sticky bottom-0 z-50">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={() => setActiveCatIdx(i => Math.max(0, i-1))}
            disabled={activeCatIdx === 0}
            className="flex-1 py-4 bg-gray-50 text-gray-400 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl disabled:opacity-30"
          >
            {isEn ? "Back" : "السابق"}
          </button>
          {activeCatIdx < categories.length - 1 ? (
            <button
              onClick={() => setActiveCatIdx(i => Math.min(categories.length - 1, i+1))}
              className="flex-1 py-4 bg-gray-900 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl"
            >
              {isEn ? "Next" : "التالي"}
            </button>
          ) : (
            <button
              onClick={() => setShowSummary(true)}
              className="flex-1 py-4 bg-nassayem text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl"
            >
              {isEn ? "Review Report" : "مراجعة التقرير"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
