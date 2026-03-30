"use client";

import { useActionState, useState } from "react";
import { createTask } from "@/app/actions/tasks";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG, STAFF_ROLE_CONFIG } from "@/lib/tasks/constants";
import type { TStaffRole } from "@/lib/tasks/constants";

type BuildingWithUnits = {
  id: string;
  nameEn: string;
  nameAr: string;
  units: { id: string; unitCode: string | null; titleEn: string; titleAr: string }[];
};

type StaffUser = { id: string; name: string | null; email: string; role: string };

type ParentTask = { id: string; title: string; type: string } | null;

type Props = {
  buildings: BuildingWithUnits[];
  assignableStaff: StaffUser[];
  locale: string;
  parentTask?: ParentTask;
};

const initialState = { error: null };

export default function CreateTaskForm({ buildings, assignableStaff, locale, parentTask }: Props) {
  const isEn = locale === "en";
  const [state, formAction, isPending] = useActionState(createTask, initialState);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const units = buildings.find((b) => b.id === selectedBuildingId)?.units ?? [];
  const showApprovalToggle = selectedType === "MAINTENANCE";

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {parentTask && (
        <input type="hidden" name="parentTaskId" value={parentTask.id} />
      )}

      {/* Parent task banner */}
      {parentTask && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <svg className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p>
            {isEn ? "Sub-task of: " : "مهمة فرعية لـ: "}
            <span className="font-semibold">{parentTask.title}</span>
          </p>
        </div>
      )}

      {/* Error banner */}
      {state.error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {state.error}
        </div>
      )}

      {/* ── Task Type ───────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {isEn ? "Task Type" : "نوع المهمة"} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.entries(TASK_TYPE_CONFIG) as [string, typeof TASK_TYPE_CONFIG[keyof typeof TASK_TYPE_CONFIG]][]).map(
            ([key, conf]) => (
              <label
                key={key}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer
                  transition-all text-center text-xs font-medium select-none
                  ${selectedType === key
                    ? `${conf.bg} ${conf.text} border-current shadow-sm`
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                <input
                  type="radio"
                  name="type"
                  value={key}
                  checked={selectedType === key}
                  onChange={() => setSelectedType(key)}
                  className="sr-only"
                  required
                />
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={conf.iconPath} />
                </svg>
                {isEn ? conf.labelEn : conf.labelAr}
              </label>
            ),
          )}
        </div>
      </div>

      {/* ── Title ───────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="title">
          {isEn ? "Title" : "العنوان"} <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder={isEn ? "e.g. Deep clean unit 302" : "مثال: تنظيف شامل للوحدة 302"}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
        />
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="description">
          {isEn ? "Description" : "الوصف"}
          <span className="text-gray-400 font-normal ms-1.5 text-xs">
            ({isEn ? "optional" : "اختياري"})
          </span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder={isEn ? "Additional details or instructions…" : "تفاصيل أو تعليمات إضافية…"}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
        />
      </div>

      {/* ── Building + Unit ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="buildingId">
            {isEn ? "Building" : "المبنى"} <span className="text-red-500">*</span>
          </label>
          <select
            id="buildingId"
            name="buildingId"
            required
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            <option value="">{isEn ? "Select building…" : "اختر المبنى…"}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {isEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="unitId">
            {isEn ? "Unit" : "الوحدة"}
            <span className="text-gray-400 font-normal ms-1.5 text-xs">
              ({isEn ? "optional" : "اختياري"})
            </span>
          </label>
          <select
            id="unitId"
            name="unitId"
            disabled={!selectedBuildingId}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {!selectedBuildingId
                ? (isEn ? "Select a building first" : "اختر مبنى أولاً")
                : (isEn ? "No specific unit" : "لا وحدة محددة")}
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitCode ? `${u.unitCode} - ` : ""}{isEn ? u.titleEn : u.titleAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Priority + Assigned To ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="priority">
            {isEn ? "Priority" : "الأولوية"} <span className="text-red-500">*</span>
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue="MEDIUM"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            {(
              Object.entries(TASK_PRIORITY_CONFIG) as [
                string,
                typeof TASK_PRIORITY_CONFIG[keyof typeof TASK_PRIORITY_CONFIG],
              ][]
            ).map(([key, conf]) => (
              <option key={key} value={key}>
                {isEn ? conf.labelEn : conf.labelAr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="assignedToId">
            {isEn ? "Assign To" : "تعيين إلى"} <span className="text-red-500">*</span>
          </label>
          {assignableStaff.length === 0 ? (
            <p className="px-4 py-2.5 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
              {isEn ? "No assignable staff found." : "لا يوجد موظفون للتعيين."}
            </p>
          ) : (
            <select
              id="assignedToId"
              name="assignedToId"
              required
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
            >
              <option value="">{isEn ? "Select staff member…" : "اختر موظفاً…"}</option>
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

      {/* ── Due Date ─────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="dueDate">
          {isEn ? "Due Date" : "تاريخ الاستحقاق"} <span className="text-red-500">*</span>
        </label>
        <input
          id="dueDate"
          name="dueDate"
          type="date"
          required
          min={new Date().toISOString().split("T")[0]}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
        />
      </div>

      {/* ── Requires Approval (MAINTENANCE only) ────────────────────────── */}
      {showApprovalToggle && (
        <label className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl cursor-pointer hover:bg-yellow-100/60 transition-colors">
          <input
            type="checkbox"
            name="requiresApproval"
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-nassayem focus:ring-nassayem cursor-pointer"
          />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              {isEn ? "Requires Approval" : "يستلزم موافقة"}
            </p>
            <p className="text-xs text-yellow-600 mt-0.5 leading-relaxed">
              {isEn
                ? "Task will be held in 'Pending Approval' until a Manager or Supervisor approves it."
                : "ستبقى المهمة في حالة 'قيد الموافقة' حتى يوافق عليها مدير أو مشرف."}
            </p>
          </div>
        </label>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100">
        <a
          href={`/${locale}/admin/tasks`}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
        >
          {isEn ? "Cancel" : "إلغاء"}
        </a>
        <button
          type="submit"
          disabled={isPending}
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
            : (isEn ? "Create Task" : "إنشاء المهمة")}
        </button>
      </div>
    </form>
  );
}
