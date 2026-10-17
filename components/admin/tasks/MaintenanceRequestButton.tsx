"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Wrench, CheckCircle2 } from "lucide-react";
import type { MaintenanceRequestCreated } from "./MaintenanceRequestModal";

// The modal (and its camera scanner) is only downloaded when someone opens it,
// so adding this button doesn't slow the dashboards down.
const MaintenanceRequestModal = dynamic(() => import("./MaintenanceRequestModal"), { ssr: false });

/**
 * "New maintenance request" button + modal, used on the Manager, Supervisor and
 * Receptionist task dashboards.
 */
export default function MaintenanceRequestButton({ locale, className }: { locale: string; className?: string }) {
  const isEn = locale === "en";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const handleCreated = useCallback(
    ({ requestNumber, technicianName, photoFailures }: MaintenanceRequestCreated) => {
      setOpen(false);
      const base = isEn
        ? `Request #${requestNumber} sent to ${technicianName}.`
        : `تم إرسال البلاغ #${requestNumber} إلى ${technicianName}.`;
      const warn = photoFailures > 0
        ? (isEn ? ` ${photoFailures} photo(s) failed to upload — add them from the task details.` : ` تعذّر رفع ${photoFailures} صورة — أضفها من تفاصيل المهمة.`)
        : "";
      setToast(base + warn);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4500);
      router.refresh(); // update the dashboard numbers / lists
    },
    [isEn, router],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex items-center justify-center gap-2 border border-nassayem/40 text-nassayem bg-white hover:bg-nassayem/5 px-5 py-2.5 rounded-xl font-bold transition-colors shrink-0"
        }
      >
        <Wrench className="w-4 h-4 shrink-0" />
        {isEn ? "New Maintenance Request" : "بلاغ صيانة جديد"}
      </button>

      {open && (
        <MaintenanceRequestModal locale={locale} onClose={() => setOpen(false)} onCreated={handleCreated} />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium bg-green-600 text-white"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {toast}
        </div>
      )}
    </>
  );
}
