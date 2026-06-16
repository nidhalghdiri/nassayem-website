"use client";

import { useActionState, useState } from "react";
import { createLaundryOrder } from "@/app/actions/laundry";
import { TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import type { Building, LaundryItemTypeOption } from "./types";

type Props = {
  buildings: Building[];
  itemTypes: LaundryItemTypeOption[];
  locale: string;
};

type Row = { key: number; itemTypeId: string; qty: string };

const initialState = { error: null };

export default function CreateLaundryOrderForm({ buildings, itemTypes, locale }: Props) {
  const isEn = locale === "en";
  const [state, formAction, isPending] = useActionState(createLaundryOrder, initialState);

  // Start with one empty row; user adds more.
  const [rows, setRows] = useState<Row[]>([{ key: 0, itemTypeId: "", qty: "1" }]);
  const [nextKey, setNextKey] = useState(1);

  const addRow = () => {
    setRows((r) => [...r, { key: nextKey, itemTypeId: "", qty: "1" }]);
    setNextKey((k) => k + 1);
  };
  const removeRow = (key: number) => {
    setRows((r) => (r.length === 1 ? r : r.filter((row) => row.key !== key)));
  };
  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  // Today at local midnight for the date input min.
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
      <input type="hidden" name="locale" value={locale} />

      {state.error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {state.error}
        </div>
      )}

      {itemTypes.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          {isEn
            ? "No laundry items are configured yet. Ask a manager to add them under Manage Items."
            : "لا توجد أصناف غسيل مُعرَّفة بعد. اطلب من المدير إضافتها من إدارة الأصناف."}
        </div>
      )}

      {/* ── Building ──────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="buildingId">
          {isEn ? "Building" : "المبنى"} <span className="text-red-500">*</span>
        </label>
        <select
          id="buildingId"
          name="buildingId"
          required
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
        >
          <option value="">{isEn ? "Select building…" : "اختر المبنى…"}</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{isEn ? b.nameEn : b.nameAr}</option>
          ))}
        </select>
      </div>

      {/* ── Needed date + Priority ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="neededDate">
            {isEn ? "Needed By" : "مطلوب بحلول"} <span className="text-red-500">*</span>
          </label>
          <input
            id="neededDate"
            name="neededDate"
            type="date"
            required
            min={todayStr}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          />
        </div>
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
            {Object.entries(TASK_PRIORITY_CONFIG).map(([key, conf]) => (
              <option key={key} value={key}>{isEn ? conf.labelEn : conf.labelAr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Items ─────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {isEn ? "Laundry Items" : "أصناف الغسيل"} <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <select
                name="itemTypeId"
                value={row.itemTypeId}
                onChange={(e) => updateRow(row.key, { itemTypeId: e.target.value })}
                required
                className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
              >
                <option value="">{isEn ? "Select item…" : "اختر الصنف…"}</option>
                {itemTypes.map((it) => (
                  <option key={it.id} value={it.id}>{isEn ? it.nameEn : it.nameAr}</option>
                ))}
              </select>
              <input
                name="requestedQty"
                type="number"
                min={1}
                step={1}
                value={row.qty}
                onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                required
                aria-label={isEn ? "Quantity" : "الكمية"}
                className="w-20 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem text-center"
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                className="shrink-0 p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={isEn ? "Remove item" : "حذف الصنف"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={itemTypes.length === 0}
          className="mt-3 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-nassayem border border-nassayem/40 rounded-xl hover:bg-nassayem/5 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          {isEn ? "Add Item" : "إضافة صنف"}
        </button>
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="notes">
          {isEn ? "Notes" : "ملاحظات"}
          <span className="text-gray-400 font-normal ms-1.5 text-xs">({isEn ? "optional" : "اختياري"})</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder={isEn ? "Anything the supervisor should know…" : "أي شيء يجب أن يعرفه المشرف…"}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
        />
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100">
        <a
          href={`/${locale}/admin/laundry`}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
        >
          {isEn ? "Cancel" : "إلغاء"}
        </a>
        <button
          type="submit"
          disabled={isPending || itemTypes.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-nassayem text-white text-sm font-medium rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending && (
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isPending ? (isEn ? "Submitting…" : "جارٍ الإرسال…") : (isEn ? "Submit Request" : "إرسال الطلب")}
        </button>
      </div>
    </form>
  );
}
