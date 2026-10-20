"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import EquipmentBoard from "@/components/admin/maintenance/EquipmentBoard";
import { getEquipmentBoardData } from "@/app/actions/equipmentBoard";
import type { EquipmentBoardData } from "@/lib/maintenance/equipmentBoardData";

/**
 * "Equipment list" tab on the Manager / Supervisor / Maintenance dashboards —
 * the same list as /admin/maintenance/equipment, loaded when the tab opens and
 * reloaded after a device or type is added or edited.
 */
export default function EquipmentListTab({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const [data, setData] = useState<{ board: EquipmentBoardData; role: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setFailed(false);
    const res = await getEquipmentBoardData();
    if (id !== requestId.current) return;
    if (res.ok) setData({ board: res.data, role: res.role });
    else setFailed(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (failed && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-slate-600">{isEn ? "Could not load the equipment list." : "تعذّر تحميل قائمة الأجهزة."}</p>
        <button type="button" onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
          {isEn ? "Try again" : "إعادة المحاولة"}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-nassayem" />
      </div>
    );
  }

  return (
    <EquipmentBoard
      embedded
      equipments={data.board.equipments}
      equipmentTypes={data.board.equipmentTypes}
      buildings={data.board.buildings}
      locale={locale}
      currentUserRole={data.role}
      onChanged={load}
    />
  );
}
