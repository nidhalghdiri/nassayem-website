import Link from "next/link";
import { LAUNDRY_STATUS_CONFIG } from "@/lib/laundry/constants";
import { stageLabel, type ReceptionistDashboardData } from "@/lib/laundry/receptionistDashboard";
import { buildingLabel } from "@/lib/buildingLabel";

type Props = { data: ReceptionistDashboardData; locale: string };

function Kpi({ label, sub, value, unit, color = "text-gray-900" }: { label: string; sub: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-base font-semibold text-gray-500 ms-1">{unit}</span>}
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-800">{label}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </div>
  );
}

// "3 d 4 h" / "5 h 20 m" / "40 m"
function duration(ms: number, isEn: boolean) {
  const m = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  const u = isEn ? { d: "d", h: "h", m: "m" } : { d: "ي", h: "س", m: "د" };
  if (d > 0) return `${d} ${u.d} ${h} ${u.h}`;
  if (h > 0) return `${h} ${u.h} ${mm} ${u.m}`;
  return `${mm} ${u.m}`;
}

export default function ReceptionistDashboard({ data, locale }: Props) {
  const isEn = locale === "en";
  const { kpis, orders, reports, buildings } = data;
  const base = `/${locale}/admin/laundry`;
  const buildingNames = buildings.map((b) => buildingLabel(b, isEn)).join(isEn ? ", " : "، ");

  if (buildings.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 text-sm">
          {isEn
            ? "You are not assigned to any building yet. Ask a manager to assign you so your laundry orders appear here."
            : "لم يتم تعيينك على أي مبنى بعد. اطلب من المدير تعيينك لتظهر طلبات المغسلة هنا."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEn ? "My Laundry" : "مغسلتي"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{buildingNames}</p>
        </div>
        <Link href={`${base}/new`} className="bg-nassayem text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-nassayem/90">
          {isEn ? "+ New request" : "+ طلب جديد"}
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={isEn ? "Active orders" : "طلبات نشطة"} sub={buildingNames} value={kpis.active} />
        <Kpi label={isEn ? "Need your confirmation" : "تحتاج تأكيد استلامك"} sub={isEn ? "Now" : "الآن"} value={kpis.needsConfirm} color={kpis.needsConfirm > 0 ? "text-amber-600" : "text-gray-900"} />
        <Kpi
          label={isEn ? "Avg ready → received" : "متوسط استلام الجاهز"}
          sub={isEn ? "Last 30 days" : "آخر 30 يوماً"}
          value={kpis.avgReadyToReceiveHours === null ? "—" : kpis.avgReadyToReceiveHours < 10 ? kpis.avgReadyToReceiveHours.toFixed(1) : Math.round(kpis.avgReadyToReceiveHours)}
          unit={kpis.avgReadyToReceiveHours === null ? undefined : isEn ? "h" : "س"}
        />
        <Kpi
          label={isEn ? "Open reports on my building" : "بلاغ مفتوح على مبناك"}
          sub={kpis.openReports ? (isEn ? `${kpis.openShortagePieces} piece(s) short` : `نقص ${kpis.openShortagePieces} قطعة`) : isEn ? "None" : "لا يوجد"}
          value={kpis.openReports}
          color={kpis.openReports > 0 ? "text-red-600" : "text-gray-900"}
        />
      </div>

      {/* My current orders */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-bold text-gray-900">{isEn ? "My current orders" : "طلباتي الحالية"}</h2>
          <span className="text-xs text-gray-500">{isEn ? "By current status" : "حسب الحالة الآن"}</span>
        </div>

        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">{isEn ? "No active orders" : "لا توجد طلبات نشطة"}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {orders.map((o) => {
              const cfg = LAUNDRY_STATUS_CONFIG[o.status];
              const late = o.msLeft < 0;
              return (
                <div key={o.id} className={`relative rounded-2xl border p-4 flex flex-col gap-3 ${o.needsConfirm ? "border-amber-400 bg-amber-50/40" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">{o.orderCode}</span>
                    {o.urgent && <span className="text-[11px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">{isEn ? "Urgent" : "عاجل"}</span>}
                  </div>

                  <div>
                    <div className={`font-bold ${o.needsConfirm ? "text-amber-700" : "text-gray-900"}`}>
                      {isEn ? cfg.labelEn : cfg.labelAr}
                      {o.needsConfirm && <span> — {isEn ? "awaiting your confirmation" : "بانتظار تأكيدك"}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {o.totalPieces} {isEn ? "pcs" : "قطعة"} ·{" "}
                      {o.itemsSummary.map((s) => {
                        const [en, ar, q] = s.split("|");
                        return `${isEn ? en : ar} ×${q}`;
                      }).join(isEn ? ", " : "، ")}
                    </div>
                    {buildings.length > 1 && <div className="text-xs text-gray-400 mt-0.5">{buildingLabel(o.building, isEn)}</div>}
                  </div>

                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= o.step ? "bg-nassayem" : "bg-gray-200"}`} />
                    ))}
                  </div>

                  <div className={`text-xs font-medium ${late ? "text-red-600" : "text-gray-500"}`}>
                    ⏱ {late
                      ? isEn ? `Late ${duration(o.msLeft, true)} past the return date` : `متأخر ${duration(o.msLeft, false)} عن موعد الإرجاع`
                      : isEn ? `Return within ${duration(o.msLeft, true)}` : `الإرجاع خلال ${duration(o.msLeft, false)}`}
                  </div>

                  <div className="mt-auto flex flex-col gap-2">
                    <Link href={`${base}/${o.id}`} className="text-center text-sm font-medium border border-gray-300 text-gray-700 rounded-lg py-1.5 hover:bg-gray-50">
                      📍 {isEn ? "Track order" : "تتبع الشحنة"}
                    </Link>
                    {o.needsConfirm && (
                      <Link href={`${base}/${o.id}`} className="text-center text-sm font-semibold bg-nassayem text-white rounded-lg py-2 hover:bg-nassayem/90">
                        {isEn ? "Confirm receipt & verify" : "تأكيد الاستلام والمطابقة"}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Latest reports */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-4">{isEn ? "Latest reports on my building" : "آخر بلاغ على مبناي"}</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-green-600 py-4 text-center">{isEn ? "No shortage or surplus reports" : "لا توجد بلاغات نقص أو زيادة"}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 text-start font-medium">{isEn ? "Order" : "الطلب"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "Type" : "النوع"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "Details" : "التفاصيل"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "Status" : "الحالة"}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.orderId} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="py-2.5">
                      <Link href={`${base}/${r.orderId}`} className="font-semibold text-nassayem hover:underline">{r.orderCode}</Link>
                    </td>
                    <td className="py-2.5 text-gray-700">
                      {r.kind === "shortage" ? (isEn ? "Shortage" : "نقص") : r.kind === "surplus" ? (isEn ? "Surplus" : "زيادة") : isEn ? "Shortage & surplus" : "نقص وزيادة"}
                    </td>
                    <td className="py-2.5 text-gray-700 space-y-0.5">
                      {r.lines.map((l, i) => {
                        const st = stageLabel(l.field);
                        return (
                          <div key={i}>
                            {isEn ? l.nameEn : l.nameAr}: {l.expected} → {l.counted}
                            <span className="text-gray-400"> · {isEn ? st.en : st.ar}</span>
                          </div>
                        );
                      })}
                    </td>
                    <td className="py-2.5">
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${r.settled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.settled ? (isEn ? "Settled" : "تمت التسوية") : isEn ? "Awaiting confirmation" : "بانتظار تأكيدك"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
