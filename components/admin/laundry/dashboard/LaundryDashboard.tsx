import Link from "next/link";
import QueueActionButton from "./QueueActionButton";
import type { LaundryDashboardData } from "@/lib/laundry/laundryDashboard";
import { TASK_PRIORITY_CONFIG, type TTaskPriority } from "@/lib/tasks/constants";
import { buildingLabel } from "@/lib/buildingLabel";

type Props = { data: LaundryDashboardData; locale: string };

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

function duration(ms: number, isEn: boolean) {
  const m = Math.max(1, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  const u = isEn ? { d: "d", h: "h", m: "m" } : { d: "ي", h: "س", m: "د" };
  return d > 0 ? `${d} ${u.d} ${h} ${u.h}` : h > 0 ? `${h} ${u.h} ${mm} ${u.m}` : `${mm} ${u.m}`;
}

const timeOf = (iso: string, isEn: boolean) =>
  new Date(iso).toLocaleTimeString(isEn ? "en-GB" : "ar-OM", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Muscat" });

export default function LaundryDashboard({ data, locale }: Props) {
  const isEn = locale === "en";
  const { kpis, queue, workload, reports } = data;
  const base = `/${locale}/admin/laundry`;
  const maxWl = Math.max(1, ...workload.map((w) => w.pieces));
  const pctColor = (p: number | null) => (p === null ? "text-gray-400" : p >= 90 ? "text-green-600" : p >= 80 ? "text-amber-600" : "text-red-600");

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isEn ? "Laundry Dashboard" : "لوحة المغسلة"}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{isEn ? "Your work queue and today's workload" : "طابور عملك وعبء العمل اليوم"}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label={isEn ? "Awaiting receipt" : "بانتظار الاستلام"} sub={isEn ? "Now" : "الآن"} value={kpis.awaitingPickup} color={kpis.awaitingPickup > 0 ? "text-amber-600" : "text-gray-900"} />
        <Kpi label={isEn ? "Processing now" : "قيد المعالجة الآن"} sub={isEn ? "In the laundry" : "في المغسلة"} value={kpis.processingNow} />
        <Kpi label={isEn ? "Ready — awaiting driver" : "جاهز — بانتظار تسليم الموصل"} sub={isEn ? "Now" : "الآن"} value={kpis.readyForDriver} color={kpis.readyForDriver > 0 ? "text-green-600" : "text-gray-900"} />
        <Kpi label={isEn ? "Pieces today" : "قطع اليوم"} sub={isEn ? "Received" : "مُستلمة"} value={kpis.piecesReceivedToday.toLocaleString()} />
        <Kpi label={isEn ? "Avg processing time" : "متوسط زمن المعالجة"} sub={isEn ? "Per order · last 7 days" : "لكل طلب · آخر 7 أيام"} value={kpis.avgProcessingHours === null ? "—" : kpis.avgProcessingHours.toFixed(1)} unit={kpis.avgProcessingHours === null ? undefined : isEn ? "h" : "س"} />
        <Kpi label={isEn ? "Ready on time" : "الالتزام بوقت الجاهزية"} sub={isEn ? "Last 7 days" : "آخر 7 أيام"} value={kpis.readyOnTimePct === null ? "—" : `${kpis.readyOnTimePct}%`} color={pctColor(kpis.readyOnTimePct)} />
      </div>

      {/* Work queue */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-bold text-gray-900">{isEn ? "Work queue" : "طابور العمل"}</h2>
          <span className="text-xs text-gray-500">{isEn ? "Sorted by priority, then wait time" : "مرتب حسب الأولوية ومدة الانتظار"}</span>
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">{isEn ? "Queue is empty" : "لا توجد طلبات في الطابور"}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  {[
                    isEn ? "Order" : "الطلب", isEn ? "Building" : "المبنى", isEn ? "Pieces" : "القطع",
                    isEn ? "Priority" : "الأولوية", isEn ? "Since" : "منذ الساعة", isEn ? "Status" : "الحالة",
                    isEn ? "Waiting" : "مدة الانتظار", isEn ? "Action" : "إجراء",
                  ].map((h) => <th key={h} className="py-2 text-start font-medium whitespace-nowrap pe-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => {
                  const pr = TASK_PRIORITY_CONFIG[r.priority as TTaskPriority];
                  const status =
                    r.overdue ? { cls: "bg-red-100 text-red-700", en: "Past target", ar: "تجاوز الوقت المستهدف" }
                    : r.status === "REQUESTED" ? { cls: "bg-blue-100 text-blue-700", en: "Awaiting receipt", ar: "بانتظار الاستلام" }
                    : r.status === "AT_LAUNDRY" ? { cls: "bg-amber-100 text-amber-700", en: "Waiting its turn", ar: "بانتظار الدور" }
                    : { cls: "bg-teal-100 text-teal-700", en: "Processing", ar: "قيد المعالجة" };
                  return (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 pe-3"><Link href={`${base}/${r.id}`} className="font-semibold text-nassayem hover:underline">{r.orderCode}</Link></td>
                      <td className="py-2.5 pe-3 text-gray-700">{buildingLabel(r.building, isEn)}</td>
                      <td className="py-2.5 pe-3 font-semibold text-gray-900">{r.pieces}</td>
                      <td className="py-2.5 pe-3"><span className={`text-xs font-semibold rounded-full px-2 py-1 ${pr?.badge ?? ""}`}>{pr ? (isEn ? pr.labelEn : pr.labelAr) : r.priority}</span></td>
                      <td className="py-2.5 pe-3 text-gray-700 whitespace-nowrap">{timeOf(r.sinceAt, isEn)}</td>
                      <td className="py-2.5 pe-3"><span className={`text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${status.cls}`}>{isEn ? status.en : status.ar}</span></td>
                      <td className="py-2.5 pe-3 whitespace-nowrap"><span className={`text-xs font-semibold rounded-full px-2 py-1 ${r.overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{duration(r.waitingMs, isEn)}</span></td>
                      <td className="py-2.5">
                        {r.status === "REQUESTED" && (
                          <Link href={`${base}/${r.id}`} className="inline-block px-3 py-1.5 rounded-lg bg-nassayem text-white text-xs font-semibold hover:bg-nassayem/90">{isEn ? "Receive & count" : "استلام وعدّ"}</Link>
                        )}
                        {r.status === "AT_LAUNDRY" && (
                          <QueueActionButton orderId={r.id} toStatus="PROCESSING" locale={locale} tone="teal" label={isEn ? "▶ Start processing" : "▶ بدء المعالجة"} />
                        )}
                        {r.status === "PROCESSING" && (
                          <QueueActionButton orderId={r.id} toStatus="READY" locale={locale} tone="green" label={isEn ? "✓ Mark ready" : "✓ جاهز"} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Workload by building */}
        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">{isEn ? "Workload by building" : "عبء العمل حسب المبنى"}</h2>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">{isEn ? "Pieces currently in your queue" : "عدد القطع الموجودة في طابورك الآن"}</p>
          {workload.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">{isEn ? "Nothing in the queue" : "لا يوجد عمل حالياً"}</p>
          ) : (
            <div className="space-y-3">
              {workload.map((w) => (
                <div key={w.id} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 font-medium text-gray-800 truncate">{buildingLabel(w, isEn)}</span>
                  <div className="h-2.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-nassayem" style={{ width: `${(w.pieces / maxWl) * 100}%` }} />
                  </div>
                  <span className="w-10 text-end font-bold text-gray-900">{w.pieces}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reports recorded by the laundry */}
        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">{isEn ? "Reports you recorded" : "بلاغات سجّلتها المغسلة"}</h2>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">{isEn ? "Count mismatches at receipt — last 7 days" : "فروقات العدّ عند الاستلام — آخر 7 أيام"}</p>
          {reports.length === 0 ? (
            <p className="text-sm text-green-600 py-6 text-center">{isEn ? "No mismatches recorded" : "لا توجد فروقات مسجّلة"}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 text-start font-medium">{isEn ? "Order" : "الطلب"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "Building" : "المبنى"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "Type" : "النوع"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "Status" : "الحالة"}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.orderId} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5"><Link href={`${base}/${r.orderId}`} className="font-semibold text-nassayem hover:underline">{r.orderCode}</Link></td>
                    <td className="py-2.5 text-gray-700">{buildingLabel(r.building, isEn)}</td>
                    <td className="py-2.5 text-gray-700">
                      {r.kind === "shortage" ? (isEn ? `Short ${r.shortage} pc` : `نقص ${r.shortage} قطعة`)
                        : r.kind === "surplus" ? (isEn ? `Extra ${r.surplus} pc` : `زيادة ${r.surplus} قطعة`)
                        : isEn ? `Short ${r.shortage} / extra ${r.surplus}` : `نقص ${r.shortage} / زيادة ${r.surplus}`}
                    </td>
                    <td className="py-2.5">
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${r.settled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {r.settled ? (isEn ? "Settled" : "تمت التسوية") : isEn ? "Open — awaiting settlement" : "مفتوح — بانتظار التسوية"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
