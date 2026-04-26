"use client";

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import { createTasksBulk } from "@/app/actions/tasks";
import type { BulkTaskInput } from "@/app/actions/tasks";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG, STAFF_ROLE_CONFIG } from "@/lib/tasks/constants";
import type { TStaffRole } from "@/lib/tasks/constants";

type BuildingOption = {
  id: string;
  nameEn: string;
  nameAr: string;
};

type StaffUser = { id: string; name: string | null; email: string; role: string };

type Props = {
  buildings: BuildingOption[];
  assignableStaff: StaffUser[];
  locale: string;
};

type TaskRow = {
  _key: string;
  type: string;
  title: string;
  description: string;
  unitNumber: string;
  assignedToId: string;
  overridePriority: boolean;
  priority: string;
  overrideDueDate: boolean;
  dueDate: string;
  requiresApproval: boolean;
};

// Shared defaults — building, priority, due date only
type SharedDefaults = {
  buildingId: string;
  priority: string;
  dueDate: string;
};

let _rowCounter = 0;
function makeKey() {
  return `row-${++_rowCounter}`;
}

function emptyRow(): TaskRow {
  return {
    _key: makeKey(),
    type: "",
    title: "",
    description: "",
    unitNumber: "",
    assignedToId: "",
    overridePriority: false,
    priority: "MEDIUM",
    overrideDueDate: false,
    dueDate: "",
    requiresApproval: false,
  };
}

export default function BulkCreateTaskForm({ buildings, assignableStaff, locale }: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  const today = new Date().toISOString().slice(0, 16);

  const [shared, setShared] = useState<SharedDefaults>({
    buildingId: "",
    priority: "MEDIUM",
    dueDate: "",
  });

  const [rows, setRows] = useState<TaskRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [result, setResult] = useState<{ success: boolean; created: number; errors: string[] } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── Row helpers ──────────────────────────────────────────────────────────────
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r._key !== key));
  }

  function updateRow(key: string, patch: Partial<TaskRow>) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function duplicateRow(key: string) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r._key === key);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], _key: makeKey(), title: "" };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setGlobalError(null);

    if (!shared.buildingId) {
      setGlobalError(isEn ? "Please select a building." : "يرجى اختيار المبنى.");
      return;
    }
    if (!shared.dueDate) {
      setGlobalError(isEn ? "Please set a default due date." : "يرجى تحديد تاريخ الاستحقاق الافتراضي.");
      return;
    }

    const filledRows = rows.filter((r) => r.type && r.title.trim() && r.assignedToId);
    if (filledRows.length === 0) {
      setGlobalError(isEn ? "Add at least one complete task row." : "أضف صفاً مكتملاً على الأقل.");
      return;
    }

    const tasks: BulkTaskInput[] = filledRows.map((r) => ({
      type: r.type as BulkTaskInput["type"],
      title: r.title.trim(),
      description: r.description.trim() || undefined,
      buildingId: shared.buildingId,
      unitNumber: r.unitNumber.trim() || undefined,
      priority: (r.overridePriority ? r.priority : shared.priority) as BulkTaskInput["priority"],
      assignedToId: r.assignedToId,
      dueDate: (r.overrideDueDate && r.dueDate) ? r.dueDate : shared.dueDate,
      requiresApproval: r.type === "MAINTENANCE" ? r.requiresApproval : false,
    }));

    startTransition(async () => {
      const res = await createTasksBulk(tasks, locale);
      setResult(res);
      if (res.success && res.created > 0) {
        setTimeout(() => router.push(`/${locale}/admin/tasks`), 1500);
      }
    });
  }

  const filledCount = rows.filter((r) => r.type && r.title.trim() && r.assignedToId).length;

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">

      {/* ── Result banner ───────────────────────────────────────────────────── */}
      {result && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border ${
          result.success
            ? "bg-green-50 border-green-200 text-green-800"
            : result.created > 0
            ? "bg-yellow-50 border-yellow-200 text-yellow-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d={result.success
                ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"}
            />
          </svg>
          <div className="space-y-1">
            <p className="font-medium">
              {result.success
                ? (isEn ? `${result.created} task(s) created successfully. Redirecting…` : `تم إنشاء ${result.created} مهمة بنجاح. جارٍ التحويل…`)
                : (isEn ? `${result.created} created, ${result.errors.length} failed.` : `تم إنشاء ${result.created}، فشل ${result.errors.length}.`)}
            </p>
            {result.errors.map((err, i) => (
              <p key={i} className="text-xs opacity-80">• {err}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Global error ────────────────────────────────────────────────────── */}
      {globalError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {globalError}
        </div>
      )}

      {/* ── SECTION 1: Shared defaults ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {isEn ? "Shared Defaults" : "الإعدادات المشتركة"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isEn
              ? "Building, priority and due date apply to all tasks unless overridden per row."
              : "المبنى والأولوية وتاريخ الاستحقاق تنطبق على جميع المهام ما لم يتم تجاوزها في كل صف."}
          </p>
        </div>

        {/* Building */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {isEn ? "Building" : "المبنى"} <span className="text-red-500">*</span>
          </label>
          <select
            value={shared.buildingId}
            onChange={(e) => setShared((s) => ({ ...s, buildingId: e.target.value }))}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            <option value="">{isEn ? "Select building…" : "اختر المبنى…"}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{isEn ? b.nameEn : b.nameAr}</option>
            ))}
          </select>
        </div>

        {/* Priority + Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isEn ? "Default Priority" : "الأولوية الافتراضية"} <span className="text-red-500">*</span>
            </label>
            <select
              value={shared.priority}
              onChange={(e) => setShared((s) => ({ ...s, priority: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
            >
              {(Object.entries(TASK_PRIORITY_CONFIG) as [string, typeof TASK_PRIORITY_CONFIG[keyof typeof TASK_PRIORITY_CONFIG]][]).map(
                ([key, conf]) => (
                  <option key={key} value={key}>{isEn ? conf.labelEn : conf.labelAr}</option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isEn ? "Default Due Date & Time" : "تاريخ ووقت الاستحقاق الافتراضي"} <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              min={today}
              value={shared.dueDate}
              onChange={(e) => setShared((s) => ({ ...s, dueDate: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Task rows ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEn ? "Tasks" : "المهام"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEn
                ? `${rows.length} row(s) · ${filledCount} ready to submit`
                : `${rows.length} صف · ${filledCount} جاهز للإرسال`}
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm font-medium text-nassayem hover:text-nassayem/80 transition-colors px-3 py-1.5 border border-nassayem/30 rounded-lg hover:bg-nassayem/5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {isEn ? "Add Row" : "إضافة صف"}
          </button>
        </div>

        {rows.map((row, idx) => (
          <TaskRowCard
            key={row._key}
            row={row}
            idx={idx}
            isEn={isEn}
            today={today}
            assignableStaff={assignableStaff}
            onUpdate={(patch) => updateRow(row._key, patch)}
            onRemove={() => removeRow(row._key)}
            onDuplicate={() => duplicateRow(row._key)}
            canRemove={rows.length > 1}
          />
        ))}

        {/* Add row button at bottom */}
        <button
          type="button"
          onClick={addRow}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-nassayem/40 hover:text-nassayem hover:bg-nassayem/5 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          {isEn ? "Add another task" : "إضافة مهمة أخرى"}
        </button>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <a
          href={`/${locale}/admin/tasks`}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
        >
          {isEn ? "Cancel" : "إلغاء"}
        </a>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {filledCount > 0
              ? (isEn ? `${filledCount} task(s) will be created` : `سيتم إنشاء ${filledCount} مهمة`)
              : (isEn ? "Fill in rows below" : "أكمل الصفوف أدناه")}
          </span>
          <button
            type="submit"
            disabled={isPending || filledCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-nassayem text-white text-sm font-medium rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending && (
              <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isPending
              ? (isEn ? "Creating…" : "جارٍ الإنشاء…")
              : (isEn ? `Create ${filledCount || ""} Tasks` : `إنشاء ${filledCount || ""} مهام`)}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Individual task row card ───────────────────────────────────────────────────
function TaskRowCard({
  row,
  idx,
  isEn,
  today,
  assignableStaff,
  onUpdate,
  onRemove,
  onDuplicate,
  canRemove,
}: {
  row: TaskRow;
  idx: number;
  isEn: boolean;
  today: string;
  assignableStaff: StaffUser[];
  onUpdate: (patch: Partial<TaskRow>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canRemove: boolean;
}) {
  const isReady = !!(row.type && row.title.trim() && row.assignedToId);
  const showApprovalToggle = row.type === "MAINTENANCE";

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${
      isReady ? "border-gray-200" : "border-gray-100"
    }`}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100">
        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
          isReady ? "bg-nassayem text-white" : "bg-gray-100 text-gray-400"
        }`}>
          {idx + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-600 truncate">
          {row.title.trim() || (isEn ? "Untitled task" : "مهمة بدون عنوان")}
        </span>
        {isReady && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            {isEn ? "Ready" : "جاهز"}
          </span>
        )}
        <button
          type="button"
          onClick={onDuplicate}
          title={isEn ? "Duplicate row" : "تكرار الصف"}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={isEn ? "Remove row" : "حذف الصف"}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Row body */}
      <div className="p-4 space-y-3">

        {/* Task Type — compact segmented buttons */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {isEn ? "Task Type" : "نوع المهمة"} <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(TASK_TYPE_CONFIG) as [string, typeof TASK_TYPE_CONFIG[keyof typeof TASK_TYPE_CONFIG]][]).map(
              ([key, conf]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onUpdate({ type: key, requiresApproval: false })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all select-none
                    ${row.type === key
                      ? `${conf.bg} ${conf.text} border-current shadow-sm`
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={conf.iconPath} />
                  </svg>
                  {isEn ? conf.labelEn : conf.labelAr}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Title + Assign To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isEn ? "Title" : "العنوان"} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={row.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              maxLength={200}
              placeholder={isEn ? "e.g. Clean unit 302" : "مثال: تنظيف الوحدة 302"}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isEn ? "Assign To" : "تعيين إلى"} <span className="text-red-500">*</span>
            </label>
            {assignableStaff.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                {isEn ? "No staff available." : "لا يوجد موظفون."}
              </p>
            ) : (
              <select
                value={row.assignedToId}
                onChange={(e) => onUpdate({ assignedToId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
              >
                <option value="">{isEn ? "Select staff…" : "اختر موظفاً…"}</option>
                {assignableStaff.map((u) => {
                  const roleConf = STAFF_ROLE_CONFIG[u.role as TStaffRole];
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email.split("@")[0]}
                      {roleConf ? ` (${isEn ? roleConf.labelEn : roleConf.labelAr})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {isEn ? "Unit" : "الوحدة"}
            <span className="text-gray-400 font-normal ms-1 text-xs">({isEn ? "optional" : "اختياري"})</span>
          </label>
          <input
            type="text"
            value={row.unitNumber}
            onChange={(e) => onUpdate({ unitNumber: e.target.value })}
            maxLength={100}
            placeholder={isEn ? "e.g. 302, Villa 5…" : "مثال: 302، فيلا 5…"}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {isEn ? "Description" : "الوصف"}
            <span className="text-gray-400 font-normal ms-1 text-xs">({isEn ? "optional" : "اختياري"})</span>
          </label>
          <textarea
            value={row.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={2}
            placeholder={isEn ? "Additional instructions…" : "تعليمات إضافية…"}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
          />
        </div>

        {/* Override toggles */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={row.overridePriority}
              onChange={(e) => onUpdate({ overridePriority: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-gray-300 text-nassayem focus:ring-nassayem cursor-pointer"
            />
            <span className="text-xs text-gray-500">{isEn ? "Custom priority" : "أولوية مخصصة"}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={row.overrideDueDate}
              onChange={(e) => onUpdate({ overrideDueDate: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-gray-300 text-nassayem focus:ring-nassayem cursor-pointer"
            />
            <span className="text-xs text-gray-500">{isEn ? "Custom due date" : "تاريخ استحقاق مخصص"}</span>
          </label>
        </div>

        {/* Override fields */}
        {(row.overridePriority || row.overrideDueDate) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {row.overridePriority && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {isEn ? "Priority" : "الأولوية"}
                </label>
                <select
                  value={row.priority}
                  onChange={(e) => onUpdate({ priority: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
                >
                  {(Object.entries(TASK_PRIORITY_CONFIG) as [string, typeof TASK_PRIORITY_CONFIG[keyof typeof TASK_PRIORITY_CONFIG]][]).map(
                    ([key, conf]) => (
                      <option key={key} value={key}>{isEn ? conf.labelEn : conf.labelAr}</option>
                    ),
                  )}
                </select>
              </div>
            )}
            {row.overrideDueDate && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {isEn ? "Due Date & Time" : "تاريخ ووقت الاستحقاق"}
                </label>
                <input
                  type="datetime-local"
                  min={today}
                  value={row.dueDate}
                  onChange={(e) => onUpdate({ dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
                />
              </div>
            )}
          </div>
        )}

        {/* Requires approval — shown only when this row's type is MAINTENANCE */}
        {showApprovalToggle && (
          <label className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100/60 transition-colors">
            <input
              type="checkbox"
              checked={row.requiresApproval}
              onChange={(e) => onUpdate({ requiresApproval: e.target.checked })}
              className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-nassayem focus:ring-nassayem cursor-pointer"
            />
            <div>
              <p className="text-xs font-medium text-yellow-800">
                {isEn ? "Requires Approval" : "يستلزم موافقة"}
              </p>
              <p className="text-xs text-yellow-600 mt-0.5">
                {isEn
                  ? "Task held until a Manager or Supervisor approves."
                  : "ستبقى المهمة قيد الموافقة حتى يوافق عليها المدير أو المشرف."}
              </p>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
