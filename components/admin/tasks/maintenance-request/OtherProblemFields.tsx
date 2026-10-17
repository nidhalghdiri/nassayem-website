"use client";

import React, { useId } from "react";
import { Droplets, Zap, Armchair, Paintbrush, Hammer, DoorOpen, Wrench, MoreHorizontal } from "lucide-react";
import {
  CATEGORY_LABELS,
  OTHER_CATEGORIES,
  OTHER_JOB_KEY,
  getJobs,
  type OtherCategoryKey,
} from "@/lib/maintenance/categories";

const CATEGORY_ICONS: Record<OtherCategoryKey, React.ComponentType<{ className?: string }>> = {
  PLUMBING: Droplets,
  ELECTRICAL: Zap,
  FURNITURE: Armchair,
  PAINTING: Paintbrush,
  INSTALLATION: Hammer,
  DOORS_WINDOWS: DoorOpen,
  GENERAL: Wrench,
  OTHER: MoreHorizontal,
};

type Props = {
  isEn: boolean;
  category: OtherCategoryKey | "";
  onCategoryChange: (c: OtherCategoryKey) => void;
  job: string;
  onJobChange: (job: string) => void;
  details: string;
  onDetailsChange: (details: string) => void;
};

/** Category → common job → details, for anything that isn't a registered device. */
export default function OtherProblemFields({ isEn, category, onCategoryChange, job, onJobChange, details, onDetailsChange }: Props) {
  const uid = useId();
  const jobs = category ? getJobs(category) : [];
  const needsDetails = category === "OTHER" || job === OTHER_JOB_KEY;

  const t = {
    category: isEn ? "Category" : "التصنيف",
    job: isEn ? "What needs doing" : "المطلوب",
    selectJob: isEn ? "Select the job" : "اختر العمل المطلوب",
    detailsPlaceholder: isEn
      ? "Additional details (optional) — e.g. the guest is in the apartment"
      : "تفاصيل إضافية (اختياري) — مثال: الضيف موجود في الشقة",
    detailsRequired: isEn ? "Describe the work needed…" : "اكتب العمل المطلوب…",
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-slate-800 mb-2">
          {t.category} <span className="text-red-500">*</span>
        </p>
        <div role="radiogroup" aria-label={t.category} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {OTHER_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c.key];
            const selected = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onCategoryChange(c.key)}
                className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-2xl border-2 text-center text-xs font-bold leading-tight transition-all ${
                  selected
                    ? "border-nassayem bg-nassayem/5 text-nassayem shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-nassayem/40 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {isEn ? CATEGORY_LABELS[c.key].en : CATEGORY_LABELS[c.key].ar}
              </button>
            );
          })}
        </div>
      </div>

      {category && jobs.length > 0 && (
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2" htmlFor={`${uid}-j`}>
            {t.job} <span className="text-red-500">*</span>
          </label>
          <select
            id={`${uid}-j`}
            value={job}
            onChange={(e) => onJobChange(e.target.value)}
            className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
          >
            <option value="">{t.selectJob}</option>
            {jobs.map((j) => (
              <option key={j.key} value={j.key}>{isEn ? j.en : j.ar}</option>
            ))}
          </select>
        </div>
      )}

      {category && (
        <div>
          <label className="sr-only" htmlFor={`${uid}-d`}>{isEn ? "Details" : "التفاصيل"}</label>
          <textarea
            id={`${uid}-d`}
            value={details}
            onChange={(e) => onDetailsChange(e.target.value)}
            rows={3}
            maxLength={1000}
            required={needsDetails}
            placeholder={needsDetails ? t.detailsRequired : t.detailsPlaceholder}
            className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
          />
        </div>
      )}
    </div>
  );
}
