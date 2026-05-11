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
const HEADER_MAP: Record<string, keyof Omit<CsvRowInput, "rowNumber">> = {
  building: "building",
  "unit type": "unitType",
  date: "date",
  "daily price": "dailyPrice",
};

const REQUIRED_HEADERS = ["building", "unit type", "date", "daily price"];

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
          building: data[HEADER_MAP.building] ?? "",
          unitType: data[HEADER_MAP["unit type"]] ?? "",
          date: data[HEADER_MAP.date] ?? "",
          dailyPrice: data[HEADER_MAP["daily price"]] ?? "",
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

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${tone}`}>{value.toLocaleString()}</p>
    </div>
  );
}
