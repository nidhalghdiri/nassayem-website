import Link from "next/link";
import type { SupervisorDashboardData, TaskKind } from "@/lib/laundry/supervisorDashboard";
import { buildingLabel } from "@/lib/buildingLabel";

type Props = { data: SupervisorDashboardData; locale: string };

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

const timeOf = (iso: string, isEn: boolean) =>
  new Date(iso).toLocaleTimeString(isEn ? "en-GB" : "ar-OM", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Muscat" });

export default function SupervisorDashboard({ data, locale }: Props) {
  const isEn = locale === "en";
  const { kpis, tasks, myDiscrepancies } = data;
  const base = `/${locale}/admin/laundry`;
  const firstPendingIdx = tasks.findIndex((t) => !t.done);

  const title = (kind: TaskKind, b: string, code: string) =>
    kind === "pickup" ? (isEn ? `Pick up from ${b} and bring to laundry (${code})` : `استلام من مبنى ${b} وتسليم للمغسلة (${code})`)
    : kind === "collect" ? (isEn ? `Collect ready laundry for ${b} (${code}) + count` : `استلام جاهز من المغسلة (طلب ${b} ${code}) + مطابقة`)
    : isEn ? `Deliver to ${b} + building confirmation (${code})` : `تسليم لمبنى ${b} + تأكيد المبنى (${code})`;

  const actionLabel = (kind: TaskKind) =>
    kind === "collect" ? (isEn ? "Record count" : "تسجيل المطابقة") : isEn ? "Open order" : "فتح الطلب";

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isEn ? "Supervisor Dashboard" : "لوحة المشرف"}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{isEn ? "Your pickups, collections and deliveries" : "مهام الاستلام والتسليم الخاصة بك"}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={isEn ? "Tasks remaining" : "مهام متبقية"} sub={isEn ? "Now" : "الآن"} value={kpis.remaining} color={kpis.remaining > 0 ? "text-amber-600" : "text-gray-900"} />
        <Kpi label={isEn ? "Tasks completed" : "مهام مكتملة"} sub={isEn ? "Today" : "اليوم"} value={kpis.completedToday} color="text-green-600" />
        <Kpi label={isEn ? "Avg trip time" : "متوسط وقت المهمة"} sub={isEn ? "Collected → delivered · last 7 days" : "من الاستلام للتسليم · آخر 7 أيام"} value={kpis.avgTripMin === null ? "—" : Math.round(kpis.avgTripMin)} unit={kpis.avgTripMin === null ? undefined : isEn ? "min" : "د"} />
        <Kpi label={isEn ? "Discrepancies you recorded" : "اختلاف سجّلته اليوم"} sub={isEn ? "Today" : "اليوم"} value={kpis.discrepanciesToday} color={kpis.discrepanciesToday > 0 ? "text-red-600" : "text-gray-900"} />
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900">{isEn ? "Today's tasks" : "مهام اليوم"}</h2>
          <span className="text-xs text-gray-500">{isEn ? "Open the order to record the count at each handoff" : "افتح الطلب لتسجيل المطابقة عند كل استلام أو تسليم"}</span>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">{isEn ? "No tasks right now" : "لا توجد مهام حالياً"}</p>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((t, idx) => {
              const current = idx === firstPendingIdx;
              const b = buildingLabel(t.building, isEn);
              return (
                <div
                  key={t.key}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    t.done ? "border-gray-100 bg-gray-50 opacity-70" : current ? "border-nassayem/50 bg-nassayem/5" : "border-gray-200"
                  }`}
                >
                  <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${t.done ? "bg-green-500" : "bg-nassayem"}`}>
                    {t.done ? "✓" : idx - tasks.filter((x, i) => i < idx && x.done).length + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${t.done ? "text-gray-500" : "text-gray-900"}`}>{title(t.kind, b, t.orderCode)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t.done ? (isEn ? "Completed at" : "اكتملت الساعة") : isEn ? "Available since" : "متاحة منذ"} {timeOf(t.at, isEn)}
                      {!t.done && (t.priority === "URGENT" || t.priority === "HIGH") && (
                        <span className="ms-2 text-[11px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">{isEn ? "Urgent" : "عاجل"}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {t.done ? (
                      <span className="text-[11px] font-semibold bg-green-100 text-green-700 rounded-full px-2.5 py-1">{isEn ? "Done" : "مكتملة"}</span>
                    ) : current ? (
                      <>
                        <span className="hidden sm:inline text-[11px] font-semibold bg-nassayem text-white rounded-full px-2.5 py-1">{isEn ? "Next" : "التالية"}</span>
                        <Link href={`${base}/${t.orderId}`} className="px-3 py-1.5 rounded-lg bg-nassayem text-white text-xs font-semibold hover:bg-nassayem/90">{actionLabel(t.kind)}</Link>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline text-[11px] font-semibold bg-gray-100 text-gray-600 rounded-full px-2.5 py-1">{isEn ? "Not started" : "لم تبدأ"}</span>
                        <Link href={`${base}/${t.orderId}`} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50">{actionLabel(t.kind)}</Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-4">{isEn ? "Discrepancies you recorded" : "اختلافات سجّلتها"}</h2>
        {myDiscrepancies.length === 0 ? (
          <p className="text-sm text-green-600 py-4 text-center">{isEn ? "No discrepancies in the last 7 days" : "لا توجد اختلافات في آخر 7 أيام"}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 text-start font-medium">{isEn ? "Order" : "الطلب"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "At" : "عند"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "Details" : "التفاصيل"}</th>
                  <th className="py-2 text-start font-medium">{isEn ? "Status" : "الحالة"}</th>
                </tr>
              </thead>
              <tbody>
                {myDiscrepancies.map((r) => (
                  <tr key={r.orderId} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5"><Link href={`${base}/${r.orderId}`} className="font-semibold text-nassayem hover:underline">{r.orderCode}</Link></td>
                    <td className="py-2.5 text-gray-700">{isEn ? "Collection from laundry" : "استلام من المغسلة"} · {buildingLabel(r.building, isEn)}</td>
                    <td className="py-2.5 text-gray-700">
                      {[r.shortage ? (isEn ? `${r.shortage} piece(s) short vs. laundry count` : `نقص ${r.shortage} قطعة عن عدّ المغسلة`) : "",
                        r.surplus ? (isEn ? `${r.surplus} piece(s) extra vs. laundry count` : `زيادة ${r.surplus} قطعة عن عدّ المغسلة`) : ""].filter(Boolean).join(" · ")}
                    </td>
                    <td className="py-2.5">
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${r.settled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.settled ? (isEn ? "Settled" : "تمت التسوية") : isEn ? "Awaiting settlement" : "بانتظار التسوية"}
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
