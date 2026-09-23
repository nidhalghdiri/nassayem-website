"use client";

import React, { useState } from "react";
import ReceptionistReviewSection from "./receptionist/ReceptionistReviewSection";
import LiveTasksSection from "./receptionist/LiveTasksSection";
import UnitsStatusSection from "./receptionist/UnitsStatusSection";

export default function ReceptionistDashboard({
  locale,
}: {
  locale: string;
}) {
  const isEn = locale === "en";
  const [selectedBranch, setSelectedBranch] = useState("branch1");

  const t = {
    branch: isEn ? "Branch" : "الفرع",
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header / Branch Selection */}
      <div className="flex justify-end mb-4">
        <div className="flex flex-col items-end gap-2">
          <label className="text-xs font-bold text-slate-500">{t.branch}</label>
          <select 
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-nassayem shadow-sm text-sm font-bold min-w-[200px]"
            dir={isEn ? "ltr" : "rtl"}
          >
            <option value="branch1">{isEn ? "Al Saadah Reception 25 (New)" : "استقبال السعادة 25 جديد"}</option>
            <option value="branch2">{isEn ? "Al Saadah Reception 24" : "استقبال السعادة 24"}</option>
          </select>
        </div>
      </div>

      {/* Main Review Section */}
      <ReceptionistReviewSection isEn={isEn} />

      {/* Live Tasks & Leaderboard */}
      <LiveTasksSection isEn={isEn} />

      {/* Units Grid & Timeline */}
      <UnitsStatusSection isEn={isEn} />
    </div>
  );
}
