"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import {
  validatePricingRows,
  confirmPricingImport,
  type CsvRowInput,
  type ValidationResult,
  type ImportResult,
} from "@/app/actions/pricing";

type BuildingHint = { id: string; nameEn: string; nameAr: string };

// Header normalizer: lower-case, collapse whitespace. Accepts the exact
// names from the spec ("Building", "Unit Type", "Date", "Daily Price"),
// case-insensitive.
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

// CSV header (after normalization) → property in CsvRowInput.
// Keys MUST match what Papa.parse exposes on each row object, which is
// the normalized header string. Values are the property names we read into.
const REQUIRED_HEADERS = ["building", "unit type", "date", "daily price"] as const;

export default function PricingImportClient({
  locale,
  buildings,
}: {
  locale: string;
  buildings: BuildingHint[];
}) {
  const isEn = locale === "en";
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isValidating, startValidate] = useTransition();
  const [isImporting, startImport] = useTransition();

  const previewRows = useMemo(
    () => validation?.valid.slice(0, 20) ?? [],
    [validation],
  );
  const errorRows = useMemo(
    () => validation?.errors.slice(0, 50) ?? [],
    [validation],
  );

  const handleFile = (file: File) => {
    setParseError(null);
    setValidation(null);
    setImportResult(null);
    setFileName(file.name);

    const accumulated: CsvRowInput[] = [];
    let rowIdx = 0;
    let headerErr: string | null = null;

    // Papa.parse with `step` streams row-by-row without loading the whole file.
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => normalizeHeader(h),
      step: (results) => {
        if (headerErr) return;
        const headers = (results.meta?.fields ?? []).map(normalizeHeader);
        // Validate headers once on the first row.
        if (rowIdx === 0) {
          const missing = REQUIRED_HEADERS.filter((r) => !headers.includes(r));
          if (missing.length > 0) {
            headerErr =
              (isEn
                ? "Missing required column(s): "
                : "أعمدة مطلوبة مفقودة: ") + missing.join(", ");
            return;
          }
        }
        rowIdx += 1;
        const data = results.data;
        accumulated.push({
          rowNumber: rowIdx,
          building: data["building"] ?? "",
          unitType: data["unit type"] ?? "",
          date: data["date"] ?? "",
          dailyPrice: data["daily price"] ?? "",
        });
      },
      complete: () => {
        if (headerErr) {
          setParseError(headerErr);
          return;
        }
        if (accumulated.length === 0) {
          setParseError(isEn ? "No rows found in file." : "لا توجد صفوف في الملف.");
          return;
        }
        startValidate(async () => {
          try {
            const result = await validatePricingRows(accumulated);
            setValidation(result);
          } catch (err: any) {
            setParseError(err?.message || "Validation failed");
          }
        });
      },
      error: (err) => {
        setParseError(err.message);
      },
    });
  };

  const handleConfirm = () => {
    if (!validation || validation.valid.length === 0) return;
    startImport(async () => {
      try {
        const result = await confirmPricingImport(validation.valid);
        setImportResult({
          ...result,
          rejected: validation.errors.length,
        });
      } catch (err: any) {
        setParseError(err?.message || "Import failed");
      }
    });
  };

  const handleReset = () => {
    setFileName(null);
    setParseError(null);
    setValidation(null);
    setImportResult(null);
  };

  // ─── States ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Drop zone / file picker */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          {isEn ? "Upload CSV" : "تحميل ملف CSV"}
        </h2>

        <label
          className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
            fileName
              ? "border-nassayem/40 bg-nassayem/5"
              : "border-gray-200 hover:border-nassayem/40 hover:bg-gray-50"
          }`}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
          <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm font-bold text-gray-700">
            {fileName ?? (isEn ? "Click to select a CSV file" : "اضغط لاختيار ملف CSV")}
          </span>
          {!fileName && (
            <span className="text-xs text-gray-400 mt-1">
              {isEn
                ? "Columns: Building, Unit Type, Date (YYYY-MM-DD), Daily Price"
                : "الأعمدة: المبنى، نوع الوحدة، التاريخ (YYYY-MM-DD)، السعر اليومي"}
            </span>
          )}
        </label>

        <details className="mt-4">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            {isEn ? "Available buildings (for reference)" : "المباني المتاحة (للمرجع)"}
          </summary>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-600">
            {buildings.map((b) => (
              <li key={b.id} className="bg-gray-50 px-3 py-1.5 rounded-lg">
                <span className="font-medium">{isEn ? b.nameEn : b.nameAr}</span>
                <span className="text-gray-400 ms-2 font-mono">{b.id.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {/* CSV format guide */}
      <CsvGuide isEn={isEn} buildings={buildings} />

      {/* Parse error */}
      {parseError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          {parseError}
        </div>
      )}

      {/* Validating spinner */}
      {isValidating && (
        <div className="flex items-center gap-3 text-gray-600 text-sm">
          <svg className="animate-spin h-5 w-5 text-nassayem" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {isEn ? "Validating rows…" : "جاري التحقق من الصفوف…"}
        </div>
      )}

      {/* Validation summary + preview */}
      {validation && !importResult && (
        <>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-3 gap-4">
            <Stat
              label={isEn ? "Total rows" : "إجمالي الصفوف"}
              value={validation.totalRows}
              tone="text-gray-900"
            />
            <Stat
              label={isEn ? "Valid" : "صالح"}
              value={validation.valid.length}
              tone="text-green-600"
            />
            <Stat
              label={isEn ? "Errors" : "أخطاء"}
              value={validation.errors.length}
              tone={validation.errors.length > 0 ? "text-red-600" : "text-gray-400"}
            />
          </div>

          {/* Preview valid rows */}
          {previewRows.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">
                  {isEn
                    ? `Preview (first ${previewRows.length} of ${validation.valid.length} valid rows)`
                    : `معاينة (أول ${previewRows.length} من ${validation.valid.length} صف صالح)`}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-start">#</th>
                      <th className="px-4 py-3 text-start">{isEn ? "Building" : "المبنى"}</th>
                      <th className="px-4 py-3 text-start">{isEn ? "Unit Type" : "نوع الوحدة"}</th>
                      <th className="px-4 py-3 text-start">{isEn ? "Date" : "التاريخ"}</th>
                      <th className="px-4 py-3 text-end">{isEn ? "Daily Price" : "السعر اليومي"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((r) => (
                      <tr key={r.rowNumber} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{r.rowNumber}</td>
                        <td className="px-4 py-2.5 text-gray-800">{r.buildingName}</td>
                        <td className="px-4 py-2.5 text-gray-800">{r.unitTypeLabel}</td>
                        <td className="px-4 py-2.5 text-gray-600 font-mono">{r.date}</td>
                        <td className="px-4 py-2.5 text-end font-semibold text-gray-900">
                          {r.dailyPrice.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {errorRows.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
                <h3 className="font-bold text-red-700">
                  {isEn
                    ? `Errors (first ${errorRows.length} of ${validation.errors.length})`
                    : `أخطاء (أول ${errorRows.length} من ${validation.errors.length})`}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50/30 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-start">#</th>
                      <th className="px-4 py-3 text-start">{isEn ? "Original Row" : "الصف الأصلي"}</th>
                      <th className="px-4 py-3 text-start">{isEn ? "Reason" : "السبب"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {errorRows.map((e) => (
                      <tr key={e.rowNumber}>
                        <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{e.rowNumber}</td>
                        <td className="px-4 py-2.5 text-gray-700 text-xs font-mono">
                          {e.raw.building} / {e.raw.unitType} / {e.raw.date} / {e.raw.dailyPrice}
                        </td>
                        <td className="px-4 py-2.5 text-red-600">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {isEn ? "Cancel" : "إلغاء"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isImporting || validation.valid.length === 0}
              className="px-6 py-3 rounded-xl font-bold text-white bg-nassayem hover:bg-nassayem-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isEn ? "Importing…" : "جاري الاستيراد…"}
                </>
              ) : (
                isEn
                  ? `Confirm Import (${validation.valid.length} rows)`
                  : `تأكيد الاستيراد (${validation.valid.length} صف)`
              )}
            </button>
          </div>
        </>
      )}

      {/* Result summary */}
      {importResult && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {isEn ? "Import complete" : "اكتمل الاستيراد"}
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label={isEn ? "Inserted" : "أُضيف"} value={importResult.inserted} tone="text-green-600" />
            <Stat label={isEn ? "Updated" : "حُدّث"} value={importResult.updated} tone="text-blue-600" />
            <Stat
              label={isEn ? "Rejected" : "مرفوض"}
              value={importResult.rejected}
              tone={importResult.rejected > 0 ? "text-red-600" : "text-gray-400"}
            />
          </div>
          <div className="flex justify-end mt-6">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-3 rounded-xl font-bold text-nassayem bg-nassayem/10 hover:bg-nassayem hover:text-white transition-colors"
            >
              {isEn ? "Import another file" : "استيراد ملف آخر"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TEMPLATE_HEADER = "Building,Unit Type,Date,Daily Price";

function CsvGuide({ isEn, buildings }: { isEn: boolean; buildings: BuildingHint[] }) {
  const sampleBuilding = buildings[0]?.nameEn ?? "Building Name";
  const quoted = /[",\n]/.test(sampleBuilding)
    ? `"${sampleBuilding.replace(/"/g, '""')}"`
    : sampleBuilding;
  const exampleRows = [
    [quoted, "Studio", "2026-12-01", "25.000"],
    [quoted, "Studio", "2026-12-02", "27.500"],
    [quoted, "1 Bedroom", "2026-12-01", "35"],
    [quoted, "2 Bedrooms", "2026-12-01", "48.250"],
  ];
  const csvText = [TEMPLATE_HEADER, ...exampleRows.map((r) => r.join(","))].join("\n");

  const downloadTemplate = () => {
    // BOM so Excel opens it as UTF-8 (needed for Arabic building names).
    const blob = new Blob(["﻿" + csvText + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pricing-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      name: "Building",
      required: true,
      desc: isEn
        ? "Building name (English or Arabic) or its ID. Must match an existing building."
        : "اسم المبنى (بالإنجليزية أو العربية) أو معرّفه. يجب أن يطابق مبنى موجودًا.",
      example: sampleBuilding,
    },
    {
      name: "Unit Type",
      required: true,
      desc: isEn
        ? "One of: Studio, 1 Bedroom, 2 Bedrooms, 3 Bedrooms, Villa (case-insensitive)."
        : "إحدى القيم: Studio، 1 Bedroom، 2 Bedrooms، 3 Bedrooms، Villa (غير حساس لحالة الأحرف).",
      example: "1 Bedroom",
    },
    {
      name: "Date",
      required: true,
      desc: isEn
        ? "One calendar day in YYYY-MM-DD format. Other formats (e.g. 01/12/2026) are rejected."
        : "يوم واحد بصيغة YYYY-MM-DD. الصيغ الأخرى (مثل 01/12/2026) تُرفض.",
      example: "2026-12-01",
    },
    {
      name: "Daily Price",
      required: true,
      desc: isEn
        ? "Number only, use a dot for decimals (up to 3). No currency symbol or thousands separator. Between 0 and 10000."
        : "رقم فقط، استخدم النقطة للكسور (حتى 3 خانات). بدون رمز عملة أو فاصل آلاف. بين 0 و10000.",
      example: "25.000",
    },
  ];

  const rules = isEn
    ? [
        "The first row must be the header with the 4 column names above (any letter case).",
        "One row = one building + unit type + one date. Add a row for each day you want to price.",
        "The same building + unit type + date cannot appear twice in the file.",
        "Existing prices for the same building, unit type and date are updated; new ones are added.",
        "If a building name contains a comma, wrap it in double quotes.",
        "Save as “CSV UTF-8” so Arabic names display correctly.",
      ]
    : [
        "يجب أن يكون الصف الأول عناوين الأعمدة الأربعة أعلاه (بأي حالة أحرف).",
        "كل صف = مبنى + نوع وحدة + يوم واحد. أضف صفًا لكل يوم تريد تسعيره.",
        "لا يمكن تكرار نفس المبنى + نوع الوحدة + التاريخ في الملف.",
        "الأسعار الموجودة لنفس المبنى ونوع الوحدة والتاريخ يتم تحديثها، والجديدة تُضاف.",
        "إذا كان اسم المبنى يحتوي على فاصلة، ضعه بين علامتي اقتباس مزدوجتين.",
        "احفظ الملف بصيغة «CSV UTF-8» لعرض الأسماء العربية بشكل صحيح.",
      ];

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isEn ? "CSV format guide" : "دليل تنسيق ملف CSV"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isEn
              ? "Follow this format so every row imports without errors."
              : "اتبع هذا التنسيق ليتم استيراد كل الصفوف دون أخطاء."}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-nassayem bg-nassayem/10 hover:bg-nassayem hover:text-white transition-colors inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
          </svg>
          {isEn ? "Download template" : "تحميل القالب"}
        </button>
      </div>

      {/* Columns */}
      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-start">{isEn ? "Column" : "العمود"}</th>
              <th className="px-4 py-3 text-start">{isEn ? "Required" : "مطلوب"}</th>
              <th className="px-4 py-3 text-start">{isEn ? "What to put" : "ما يجب إدخاله"}</th>
              <th className="px-4 py-3 text-start">{isEn ? "Example" : "مثال"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {columns.map((c) => (
              <tr key={c.name}>
                <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{c.name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                    {isEn ? "Yes" : "نعم"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 min-w-[240px]">{c.desc}</td>
                <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{c.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Example file */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">
          {isEn ? "Example file" : "مثال على الملف"}
        </h3>
        <pre
          dir="ltr"
          className="bg-gray-900 text-green-300 text-xs md:text-sm font-mono rounded-xl p-4 overflow-x-auto text-left"
        >
          {csvText}
        </pre>
      </div>

      {/* Rules */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">
          {isEn ? "Rules & tips" : "قواعد ونصائح"}
        </h3>
        <ul className="space-y-1.5 text-sm text-gray-600 list-disc ps-5">
          {rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      {/* Allowed unit types */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500">
          {isEn ? "Accepted Unit Type values:" : "قيم نوع الوحدة المقبولة:"}
        </span>
        {["Studio", "1 Bedroom", "2 Bedrooms", "3 Bedrooms", "Villa"].map((t) => (
          <code key={t} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-mono">
            {t}
          </code>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${tone}`}>{value.toLocaleString()}</p>
    </div>
  );
}
