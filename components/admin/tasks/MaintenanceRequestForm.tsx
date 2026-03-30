"use client";

import { useActionState, useState } from "react";
import { createMaintenanceRequest } from "@/app/actions/tasks";
import { TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";

type BuildingWithUnits = {
  id: string;
  nameEn: string;
  nameAr: string;
  units: { id: string; unitCode: string | null; titleEn: string; titleAr: string }[];
};

type Props = {
  buildings: BuildingWithUnits[];
  locale: string;
};

const initialState = { error: null };

export default function MaintenanceRequestForm({ buildings, locale }: Props) {
  const isEn = locale === "en";
  const [state, formAction, isPending] = useActionState(
    createMaintenanceRequest,
    initialState,
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState("");

  const units = buildings.find((b) => b.id === selectedBuildingId)?.units ?? [];

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6"
    >
      <input type="hidden" name="locale" value={locale} />

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
        <svg
          className="w-5 h-5 shrink-0 mt-0.5 text-yellow-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p>
          {isEn
            ? "Your request will be submitted for Manager or Supervisor approval before work begins."
            : "سيتم إرسال طلبك للمراجعة من قِبَل المدير أو المشرف قبل البدء بالعمل."}
        </p>
      </div>

      {/* Error */}
      {state.error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg
            className="w-4 h-4 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {state.error}
        </div>
      )}

      {/* Issue title */}
      <div>
        <label
          className="block text-sm font-medium text-gray-700 mb-1.5"
          htmlFor="title"
        >
          {isEn ? "Issue Title" : "عنوان المشكلة"}{" "}
          <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder={
            isEn
              ? "e.g. Broken AC in unit 204"
              : "مثال: تكييف معطل في الوحدة 204"
          }
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
        />
      </div>

      {/* Description */}
      <div>
        <label
          className="block text-sm font-medium text-gray-700 mb-1.5"
          htmlFor="description"
        >
          {isEn ? "Description" : "الوصف"}
          <span className="text-gray-400 font-normal ms-1.5 text-xs">
            ({isEn ? "optional" : "اختياري"})
          </span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder={
            isEn
              ? "Describe the issue in detail — what happened, when, any relevant observations…"
              : "صِف المشكلة بالتفصيل — ما الذي حدث، متى، وأي ملاحظات ذات صلة…"
          }
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
        />
      </div>

      {/* Building + Unit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1.5"
            htmlFor="buildingId"
          >
            {isEn ? "Building" : "المبنى"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <select
            id="buildingId"
            name="buildingId"
            required
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            <option value="">
              {isEn ? "Select building…" : "اختر المبنى…"}
            </option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {isEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1.5"
            htmlFor="unitId"
          >
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
                ? isEn
                  ? "Select a building first"
                  : "اختر مبنى أولاً"
                : isEn
                  ? "No specific unit"
                  : "لا وحدة محددة"}
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitCode ? `${u.unitCode} - ` : ""}{isEn ? u.titleEn : u.titleAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Priority + Due Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1.5"
            htmlFor="priority"
          >
            {isEn ? "Urgency" : "مستوى الإلحاح"}{" "}
            <span className="text-red-500">*</span>
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
                (typeof TASK_PRIORITY_CONFIG)[keyof typeof TASK_PRIORITY_CONFIG],
              ][]
            ).map(([key, conf]) => (
              <option key={key} value={key}>
                {isEn ? conf.labelEn : conf.labelAr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1.5"
            htmlFor="dueDate"
          >
            {isEn ? "Needed By" : "مطلوب بحلول"}{" "}
            <span className="text-red-500">*</span>
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
      </div>

      {/* Actions */}
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
            <svg
              className="w-4 h-4 animate-spin shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {isPending
            ? isEn
              ? "Submitting…"
              : "جارٍ الإرسال…"
            : isEn
              ? "Submit Request"
              : "إرسال الطلب"}
        </button>
      </div>
    </form>
  );
}
