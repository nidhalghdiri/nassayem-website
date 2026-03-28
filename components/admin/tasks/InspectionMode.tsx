"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  OVERALL_RATING_CONFIG,
  SEVERITY_CONFIG,
  CHECKLIST_CATEGORIES,
} from "@/lib/tasks/inspection";
import type { TItemStatus, TSeverity, TOverallRating } from "@/lib/tasks/inspection";

// ── Types ────────────────────────────────────────────────────────────────────

type ChecklistItem = {
  id: string;
  category: string;
  label: string;
  status: string;
  notes: string | null;
  severity: string | null;
  photoUrls: string[];
  displayOrder: number;
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
  building: { nameEn: string; nameAr: string } | null;
  unit: { titleEn: string; titleAr: string } | null;
};

type Props = {
  task: Task;
  checklist: Checklist;
  locale: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const ITEM_STATUS_CLASSES: Record<TItemStatus, string> = {
  pending: "border-gray-200 bg-white",
  pass:    "border-green-300 bg-green-50",
  fail:    "border-red-300 bg-red-50",
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
  const [overallRating, setOverallRating] = useState<TOverallRating | null>(
    (initial.overallRating as TOverallRating) ?? null,
  );
  const [inspectorNotes, setInspectorNotes] = useState(initial.inspectorNotes ?? "");
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photoUploading, setPhotoUploading] = useState<string | null>(null); // itemId being uploaded

  const categories = CHECKLIST_CATEGORIES;
  const activeCategory = categories[activeCatIdx];
  const categoryItems = items.filter((i) => i.category === activeCategory);

  // Progress counts
  const checkedCount = items.filter((i) => i.status !== "pending").length;
  const failCount = items.filter((i) => i.status === "fail").length;
  const passCount = items.filter((i) => i.status === "pass").length;
  const naCount = items.filter((i) => i.status === "na").length;
  const allChecked = checkedCount === items.length;
  const progressPct = Math.round((checkedCount / items.length) * 100);

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

  function setItemStatus(itemId: string, status: TItemStatus) {
    patchItem(itemId, {
      status,
      ...(status !== "fail" && { severity: null }),
    });
  }

  function setItemSeverity(itemId: string, severity: TSeverity) {
    patchItem(itemId, { severity });
  }

  function setItemNotes(itemId: string, notes: string) {
    updateItemLocal(itemId, { notes });
  }

  async function saveItemNotes(itemId: string, notes: string) {
    await fetch(`/api/tasks/${task.id}/checklist/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
  }

  // ── Photo upload for checklist item ──────────────────────────────────────

  async function handleItemPhoto(
    e: React.ChangeEvent<HTMLInputElement>,
    itemId: string,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(itemId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("caption", `Inspection item: ${items.find((i) => i.id === itemId)?.label ?? ""}`);
      const res = await fetch(`/api/tasks/${task.id}/photos`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        const photo = await res.json();
        const item = items.find((i) => i.id === itemId);
        if (item) {
          const newUrls = [...item.photoUrls, photo.photoUrl as string];
          await patchItem(itemId, { photoUrls: newUrls });
        }
        showToast(isEn ? "Photo attached." : "تم إرفاق الصورة.");
      } else {
        showToast(isEn ? "Failed to upload photo." : "تعذّر رفع الصورة.", "error");
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
        body: JSON.stringify({ overallRating, inspectorNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to complete inspection.", "error");
        return;
      }
      showToast(isEn ? "Inspection completed!" : "اكتمل الفحص!");
      setTimeout(() => {
        router.push(`/${locale}/admin/tasks?taskId=${task.id}`);
      }, 1200);
    } finally {
      setCompleting(false);
    }
  }

  // ── If already completed, show read-only report ──────────────────────────
  if (initial.completedAt) {
    return (
      <InspectionReport
        task={task}
        checklist={{ ...initial, items }}
        locale={locale}
      />
    );
  }

  // ── Summary screen ───────────────────────────────────────────────────────
  if (showSummary) {
    const failsBySeverity = {
      critical: items.filter((i) => i.status === "fail" && i.severity === "critical"),
      major:    items.filter((i) => i.status === "fail" && i.severity === "major"),
      minor:    items.filter((i) => i.status === "fail" && i.severity === "minor"),
      unsorted: items.filter((i) => i.status === "fail" && !i.severity),
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setShowSummary(false)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">{isEn ? "Inspection Summary" : "ملخص الفحص"}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{task.title}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-2xl mx-auto w-full">
          {/* Count cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{passCount}</p>
              <p className="text-xs text-green-600 mt-0.5">{isEn ? "Passed" : "اجتاز"}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{failCount}</p>
              <p className="text-xs text-red-600 mt-0.5">{isEn ? "Failed" : "لم يجتز"}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{naCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">{isEn ? "N/A" : "لا ينطبق"}</p>
            </div>
          </div>

          {/* Failed items grouped by severity */}
          {failCount > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-700">
                {isEn ? "Issues Found" : "المشاكل المكتشفة"}
              </h2>
              {(["critical", "major", "minor", "unsorted"] as const).map((sev) => {
                const group = failsBySeverity[sev];
                if (!group.length) return null;
                return (
                  <div key={sev} className="space-y-2">
                    {sev !== "unsorted" && (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${SEVERITY_CONFIG[sev as TSeverity].badge}`}>
                        {isEn ? SEVERITY_CONFIG[sev as TSeverity].labelEn : SEVERITY_CONFIG[sev as TSeverity].labelAr}
                      </span>
                    )}
                    {group.map((item) => (
                      <div key={item.id} className="bg-white rounded-xl border border-red-200 px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
                        {item.photoUrls.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {item.photoUrls.slice(0, 4).map((url, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={url} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Overall rating */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">
              {isEn ? "Overall Rating" : "التقييم العام"}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(OVERALL_RATING_CONFIG) as TOverallRating[]).map((r) => {
                const conf = OVERALL_RATING_CONFIG[r];
                const selected = overallRating === r;
                return (
                  <button
                    key={r}
                    onClick={() => setOverallRating(r)}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      selected
                        ? `${conf.bg} ${conf.border} ${conf.badge.split(" ")[1]}`
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {isEn ? conf.labelEn : conf.labelAr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inspector notes */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Inspector Notes" : "ملاحظات المفتش"}
              <span className="text-gray-400 font-normal ms-1.5 text-xs">({isEn ? "optional" : "اختياري"})</span>
            </h2>
            <textarea
              value={inspectorNotes}
              onChange={(e) => setInspectorNotes(e.target.value)}
              rows={3}
              placeholder={isEn ? "Overall observations…" : "الملاحظات العامة…"}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
            />
          </div>

          {/* Confirm button */}
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full py-4 bg-nassayem text-white font-bold text-base rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {completing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isEn ? "Saving…" : "جارٍ الحفظ…"}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isEn ? "Complete Inspection" : "إنهاء الفحص"}
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Main checklist view ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-none ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.push(`/${locale}/admin/tasks?taskId=${task.id}`)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-gray-900 truncate">{task.title}</h1>
              {task.building && (
                <span className="text-xs text-gray-400 shrink-0">
                  · {isEn ? task.building.nameEn : task.building.nameAr}
                  {task.unit && ` · ${isEn ? task.unit.titleEn : task.unit.titleAr}`}
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-nassayem rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 shrink-0 font-medium">
                {checkedCount}/{items.length}
              </span>
            </div>
          </div>
          {allChecked && (
            <button
              onClick={() => setShowSummary(true)}
              className="shrink-0 px-3 py-1.5 bg-nassayem text-white text-xs font-bold rounded-lg hover:bg-nassayem/90 transition-colors"
            >
              {isEn ? "Review →" : "مراجعة →"}
            </button>
          )}
        </div>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-0 max-w-2xl mx-auto">
          {categories.map((cat, idx) => {
            const catItems = items.filter((i) => i.category === cat);
            const catFails = catItems.filter((i) => i.status === "fail").length;
            const catDone = catItems.every((i) => i.status !== "pending");
            return (
              <button
                key={cat}
                onClick={() => setActiveCatIdx(idx)}
                className={`relative flex-shrink-0 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  idx === activeCatIdx
                    ? "border-nassayem text-nassayem"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {cat}
                {catFails > 0 && (
                  <span className="absolute top-1.5 end-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {catFails}
                  </span>
                )}
                {catDone && catFails === 0 && (
                  <span className="absolute top-1.5 end-1 w-3 h-3 bg-green-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Checklist items ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl mx-auto w-full pb-28">
        {categoryItems.map((item) => {
          const status = item.status as TItemStatus;
          const isFail = status === "fail";

          return (
            <div
              key={item.id}
              className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${ITEM_STATUS_CLASSES[status]}`}
            >
              {/* Item header */}
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <p className={`text-sm font-medium leading-snug ${status === "na" ? "text-gray-400" : "text-gray-800"}`}>
                  {item.label}
                </p>

                {/* Pass / Fail / N/A buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setItemStatus(item.id, "pass")}
                    className={`w-10 h-9 rounded-lg text-xs font-bold border-2 transition-all ${
                      status === "pass"
                        ? "bg-green-500 border-green-500 text-white shadow-sm"
                        : "border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-600"
                    }`}
                    title={isEn ? "Pass" : "اجتاز"}
                  >✓</button>
                  <button
                    onClick={() => setItemStatus(item.id, "fail")}
                    className={`w-10 h-9 rounded-lg text-xs font-bold border-2 transition-all ${
                      status === "fail"
                        ? "bg-red-500 border-red-500 text-white shadow-sm"
                        : "border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-600"
                    }`}
                    title={isEn ? "Fail" : "فشل"}
                  >✗</button>
                  <button
                    onClick={() => setItemStatus(item.id, "na")}
                    className={`w-10 h-9 rounded-lg text-xs font-bold border-2 transition-all ${
                      status === "na"
                        ? "bg-gray-400 border-gray-400 text-white shadow-sm"
                        : "border-gray-200 text-gray-400 hover:border-gray-400"
                    }`}
                    title={isEn ? "N/A" : "لا ينطبق"}
                  >—</button>
                </div>
              </div>

              {/* Fail details — expanded section */}
              {isFail && (
                <div className="px-4 pb-4 space-y-3 border-t border-red-200 pt-3">
                  {/* Severity */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      {isEn ? "Severity" : "مستوى الخطورة"}
                    </p>
                    <div className="flex gap-2">
                      {(["minor", "major", "critical"] as TSeverity[]).map((sev) => {
                        const conf = SEVERITY_CONFIG[sev];
                        const selected = item.severity === sev;
                        return (
                          <button
                            key={sev}
                            onClick={() => setItemSeverity(item.id, sev)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              selected
                                ? conf.badge + " border-current"
                                : "border-gray-200 text-gray-400 hover:border-gray-300"
                            }`}
                          >
                            {isEn ? conf.labelEn : conf.labelAr}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">
                      {isEn ? "Notes" : "ملاحظات"}
                    </p>
                    <textarea
                      value={item.notes ?? ""}
                      onChange={(e) => setItemNotes(item.id, e.target.value)}
                      onBlur={(e) => saveItemNotes(item.id, e.target.value)}
                      rows={2}
                      placeholder={isEn ? "Describe the issue…" : "وصف المشكلة…"}
                      className="w-full px-3 py-2 text-sm border border-red-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                    />
                  </div>

                  {/* Photo capture */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {photoUploading === item.id
                          ? (isEn ? "Uploading…" : "جارٍ الرفع…")
                          : (isEn ? "Add Photo" : "إضافة صورة")}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={photoUploading !== null}
                          onChange={(e) => handleItemPhoto(e, item.id)}
                        />
                      </label>
                      {/* Thumbnails */}
                      {item.photoUrls.map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={url} alt="" className="w-10 h-10 rounded-lg object-cover border border-red-200" />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Bottom action bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 sticky bottom-0 z-10">
        <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setActiveCatIdx((i) => Math.max(0, i - 1))}
            disabled={activeCatIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            {isEn ? "Prev" : "السابق"}
          </button>

          {activeCatIdx < categories.length - 1 ? (
            <button
              onClick={() => setActiveCatIdx((i) => Math.min(categories.length - 1, i + 1))}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-nassayem text-white text-sm font-medium rounded-xl hover:bg-nassayem/90 transition-colors"
            >
              {isEn ? "Next" : "التالي"}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setShowSummary(true)}
              disabled={!allChecked}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-nassayem text-white text-sm font-bold rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!allChecked ? (isEn ? "Check all items first" : "تحقق من جميع العناصر أولاً") : undefined}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isEn ? "Finish & Review" : "إنهاء ومراجعة"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inspection Report (read-only) ─────────────────────────────────────────────

function InspectionReport({
  task,
  checklist,
  locale,
}: {
  task: Task;
  checklist: Checklist & { items: ChecklistItem[] };
  locale: string;
}) {
  const isEn = locale === "en";
  const router = useRouter();

  const failItems = checklist.items.filter((i) => i.status === "fail");
  const passItems = checklist.items.filter((i) => i.status === "pass");
  const naItems   = checklist.items.filter((i) => i.status === "na");
  const rating = checklist.overallRating as TOverallRating | null;
  const ratingConf = rating ? OVERALL_RATING_CONFIG[rating] : null;

  const categories = [...new Set(checklist.items.map((i) => i.category))];

  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["General"]));
  function toggleCat(cat: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.push(`/${locale}/admin/tasks?taskId=${task.id}`)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-bold text-gray-900">{isEn ? "Inspection Report" : "تقرير الفحص"}</h1>
              {ratingConf && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ratingConf.badge}`}>
                  {isEn ? ratingConf.labelEn : ratingConf.labelAr}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{task.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-5">
        {/* Summary bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{passItems.length}</p>
              <p className="text-xs text-gray-500">{isEn ? "Passed" : "اجتاز"}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{failItems.length}</p>
              <p className="text-xs text-gray-500">{isEn ? "Failed" : "فشل"}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-500">{naItems.length}</p>
              <p className="text-xs text-gray-500">{isEn ? "N/A" : "لا ينطبق"}</p>
            </div>
          </div>
          {/* Stacked bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            <div className="bg-green-400 h-full transition-all" style={{ width: `${(passItems.length / checklist.items.length) * 100}%` }} />
            <div className="bg-red-400 h-full transition-all" style={{ width: `${(failItems.length / checklist.items.length) * 100}%` }} />
            <div className="bg-gray-300 h-full transition-all" style={{ width: `${(naItems.length / checklist.items.length) * 100}%` }} />
          </div>
        </div>

        {/* Failed items */}
        {failItems.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-gray-700">
              {isEn ? "Issues Found" : "المشاكل المكتشفة"}
            </h2>
            {(["critical", "major", "minor"] as TSeverity[]).map((sev) => {
              const group = failItems.filter((i) => i.severity === sev);
              if (!group.length) return null;
              const conf = SEVERITY_CONFIG[sev];
              return (
                <div key={sev} className="space-y-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${conf.badge}`}>
                    {isEn ? conf.labelEn : conf.labelAr}
                  </span>
                  {group.map((item) => (
                    <div key={item.id} className="bg-white rounded-xl border border-red-200 px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
                      {item.photoUrls.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {item.photoUrls.map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Items with no severity set */}
            {failItems.filter((i) => !i.severity).map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-red-200 px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Inspector notes */}
        {checklist.inspectorNotes && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {isEn ? "Inspector Notes" : "ملاحظات المفتش"}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {checklist.inspectorNotes}
            </p>
          </div>
        )}

        {/* All items accordion */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-700">
            {isEn ? "All Items" : "جميع العناصر"}
          </h2>
          {categories.map((cat) => {
            const catItems = checklist.items.filter((i) => i.category === cat);
            const isOpen = openCategories.has(cat);
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <span className="text-sm font-semibold text-gray-700">{cat}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {catItems.map((item) => (
                      <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">{item.label}</span>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          item.status === "pass" ? "bg-green-100 text-green-700"
                          : item.status === "fail" ? "bg-red-100 text-red-700"
                          : item.status === "na" ? "bg-gray-100 text-gray-500"
                          : "bg-gray-100 text-gray-400"
                        }`}>
                          {item.status === "pass" ? (isEn ? "Pass" : "اجتاز")
                          : item.status === "fail" ? (isEn ? "Fail" : "فشل")
                          : item.status === "na" ? (isEn ? "N/A" : "لا ينطبق")
                          : (isEn ? "—" : "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
