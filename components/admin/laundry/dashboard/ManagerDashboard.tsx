import Link from "next/link";
import PeriodFilter from "./PeriodFilter";
import SettleButton from "./SettleButton";
import { LAUNDRY_STATUS_CONFIG, type TLaundryStatus } from "@/lib/laundry/constants";
import { stageOwner, type DashboardData, type Rating } from "@/lib/laundry/dashboard";
import { buildingLabel } from "@/lib/buildingLabel";

type Props = { data: DashboardData; locale: string };

const fmtHours = (h: number | null, isEn: boolean) =>
  h === null ? "—" : `${h < 10 ? h.toFixed(1) : Math.round(h)} ${isEn ? "h" : "س"}`;
const fmtMin = (m: number | null, isEn: boolean) =>
  m === null ? "—" : `${Math.round(m)} ${isEn ? "min" : "د"}`;
const fmtPct = (p: number | null) => (p === null ? "—" : `${p}%`);

const RATING_STYLE: Record<Rating, { cls: string; en: string; ar: string }> = {
  good: { cls: "bg-green-100 text-green-700", en: "Good", ar: "جيد" },
  medium: { cls: "bg-amber-100 text-amber-700", en: "Fair", ar: "متوسط" },
  weak: { cls: "bg-red-100 text-red-700", en: "Weak", ar: "ضعيف" },
};

const pctColor = (p: number | null) =>
  p === null ? "text-gray-400" : p >= 90 ? "text-green-600" : p >= 80 ? "text-amber-600" : "text-red-600";

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-2xl p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

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

function Bar({ ratio, className = "bg-nassayem" }: { ratio: number; className?: string }) {
  return (
    <div className="h-2.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </div>
  );
}

export default function ManagerDashboard({ data, locale }: Props) {
  const isEn = locale === "en";
  const { kpis, pipeline, buildings, drivers, trend, openReports, period } = data;
  const periodLabel =
    period.key === "today" ? (isEn ? "today" : "اليوم")
    : period.key === "7d" ? (isEn ? "last 7 days" : "آخر 7 أيام")
    : period.key === "30d" ? (isEn ? "last 30 days" : "آخر 30 يوم")
    : `${period.fromStr} → ${period.toStr}`;
  const inPeriod = isEn ? "Within the selected period" : "خلال الفترة المحددة";
  const live = isEn ? "Live — not affected by the filter" : "وقتي — لا يتأثر بالفلتر";

  const maxCount = Math.max(1, ...pipeline.map((p) => p.count));
  const maxCycle = Math.max(1, ...buildings.map((b) => b.avgCycleHours ?? 0));
  const maxTrend = Math.max(1, ...trend.map((t) => t.count));
  const weekday = (d: string) =>
    new Date(`${d}T12:00:00+04:00`).toLocaleDateString(isEn ? "en-GB" : "ar", { weekday: trend.length > 7 ? undefined : "short", day: trend.length > 7 ? "numeric" : undefined, timeZone: "Asia/Muscat" });

  const kindLabel = (r: DashboardData["openReports"][number]) =>
    r.kind === "shortage" ? (isEn ? `Shortage ${r.shortage} pc` : `نقص ${r.shortage} قطعة`)
    : r.kind === "surplus" ? (isEn ? `Surplus ${r.surplus} pc` : `زيادة ${r.surplus} قطعة`)
    : isEn ? `Short ${r.shortage} / extra ${r.surplus}` : `نقص ${r.shortage} / زيادة ${r.surplus}`;

  const openFor = (iso: string) => {
    const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
    return h < 48 ? `${Math.max(1, Math.round(h))} ${isEn ? "h" : "س"}` : `${Math.round(h / 24)} ${isEn ? "d" : "ي"}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isEn ? "Manager Dashboard" : "لوحة المدير"}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isEn ? "A full view of all buildings, drivers and the laundry" : "رؤية شاملة على كل المباني والموصلين والمغسلة"}
        </p>
      </div>

      {/* Period */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter locale={locale} period={period.key} from={period.fromStr} to={period.toStr} />
        <p className="text-xs text-gray-500">
          {isEn
            ? `These cards show performance for ${periodLabel}. The "now" indicators below are always live.`
            : `تعرض هذه البطاقات أداء ${periodLabel}. مؤشرات «الآن» بالأسفل مباشرة وقتية دائماً.`}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={isEn ? "Orders" : "الطلبات"} sub={inPeriod} value={kpis.orders.toLocaleString()} />
        <Kpi label={isEn ? "Avg full-cycle time" : "متوسط زمن الدورة الكاملة"} sub={isEn ? "From request to final delivery" : "من الطلب حتى التسليم النهائي"} value={kpis.avgCycleHours === null ? "—" : kpis.avgCycleHours < 10 ? kpis.avgCycleHours.toFixed(1) : Math.round(kpis.avgCycleHours)} unit={kpis.avgCycleHours === null ? undefined : isEn ? "h" : "س"} />
        <Kpi label={isEn ? "On-time delivery" : "الالتزام بالمواعيد"} sub={inPeriod} value={fmtPct(kpis.onTimePct)} color={pctColor(kpis.onTimePct)} />
        <Kpi label={isEn ? "Orders with no discrepancy" : "طلبات بلا أي بلاغ"} sub={inPeriod} value={fmtPct(kpis.noDiscrepancyPct)} color={pctColor(kpis.noDiscrepancyPct)} />
        <Kpi label={isEn ? "Total pieces" : "إجمالي القطع"} sub={inPeriod} value={kpis.totalPieces.toLocaleString()} />
        <Kpi label={isEn ? "Avg driver response" : "متوسط استجابة الموصل"} sub={isEn ? "Ready → collected" : "من الجاهزية حتى الاستلام"} value={kpis.avgDriverResponseMin === null ? "—" : Math.round(kpis.avgDriverResponseMin)} unit={kpis.avgDriverResponseMin === null ? undefined : isEn ? "min" : "د"} />
        <Kpi label={isEn ? "Active orders now" : "طلبات نشطة الآن"} sub={live} value={kpis.activeNow} />
        <Kpi label={isEn ? "Open reports now" : "بلاغات مفتوحة الآن"} sub={live} value={kpis.openReportsNow} color={kpis.openReportsNow > 0 ? "text-red-600" : "text-gray-900"} />
      </div>

      {/* Pipeline */}
      <Card
        title={isEn ? "Full cycle path — now" : "مسار الدورة الكاملة — الآن"}
        subtitle={isEn ? "Active orders and the average time spent in each stage (live)" : "عدد الطلبات النشطة ومتوسط الوقت في كل مرحلة (وقتي دائماً)"}
      >
        <div className="space-y-3">
          {pipeline.map((p) => {
            const cfg = LAUNDRY_STATUS_CONFIG[p.status as TLaundryStatus];
            return (
              <div key={p.status} className="flex items-center gap-3 text-sm">
                <span className="w-40 sm:w-56 shrink-0 font-medium text-gray-800">{isEn ? cfg.labelEn : cfg.labelAr}</span>
                <Bar ratio={p.count / maxCount} />
                <span className="w-8 text-end font-bold text-gray-900">{p.count}</span>
                <span className="w-16 text-end text-xs text-gray-400">~{fmtHours(p.avgHours, isEn)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Building efficiency */}
        <Card
          title={isEn ? "Building efficiency" : "كفاءة المباني"}
          subtitle={isEn ? `Avg cycle · on-time rate — ${periodLabel}` : `دورة متوسطة · التزام — ${periodLabel}`}
        >
          {buildings.length === 0 ? (
            <Empty isEn={isEn} />
          ) : (
            <div className="space-y-3">
              {buildings.map((b) => {
                const r = b.rating ? RATING_STYLE[b.rating] : null;
                return (
                  <div key={b.id} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 font-medium text-gray-800 truncate">{buildingLabel(b, isEn)}</span>
                    <Bar ratio={(b.avgCycleHours ?? 0) / maxCycle} />
                    <span className="w-14 text-end font-semibold text-gray-900">{fmtHours(b.avgCycleHours, isEn)}</span>
                    <span
                      title={isEn ? `${b.shortagePieces} short · ${b.surplusPieces} extra` : `نقص ${b.shortagePieces} · زيادة ${b.surplusPieces}`}
                      className={`w-24 text-center text-xs font-semibold rounded-full px-2 py-1 ${r ? r.cls : "bg-gray-100 text-gray-400"}`}
                    >
                      {r ? `${isEn ? r.en : r.ar} · ${b.onTimePct}%` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Drivers */}
        <Card title={isEn ? "Driver performance" : "أداء الموصلين"} subtitle={periodLabel}>
          {drivers.length === 0 ? (
            <Empty isEn={isEn} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-2 text-start font-medium">{isEn ? "Driver" : "الموصل"}</th>
                    <th className="py-2 text-start font-medium">{isEn ? "Orders" : "مهام"}</th>
                    <th className="py-2 text-start font-medium">{isEn ? "Avg trip time" : "متوسط وقت المهمة"}</th>
                    <th className="py-2 text-start font-medium">{isEn ? "Counts matched" : "مطابقات صحيحة"}</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 font-medium text-gray-900">{d.name}</td>
                      <td className="py-2.5 text-gray-700">{d.orders}</td>
                      <td className="py-2.5 text-gray-700">{fmtMin(d.avgTripMin, isEn)}</td>
                      <td className={`py-2.5 font-semibold ${pctColor(d.accuracyPct)}`}>{fmtPct(d.accuracyPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Trend */}
        <Card title={isEn ? "Order trend" : "اتجاه الطلبات"} subtitle={isEn ? `Total orders per day — ${trend.length} days` : `إجمالي الطلبات — آخر ${trend.length} يوم`}>
          <div className="flex items-end gap-1.5 h-40">
            {trend.map((t) => (
              <div key={t.date} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[11px] font-semibold text-gray-700">{trend.length <= 14 ? t.count : ""}</span>
                <div
                  title={`${t.date}: ${t.count}`}
                  className={`w-full rounded-t-md ${t.isToday ? "bg-nassayem" : "bg-gray-200"}`}
                  style={{ height: `${Math.max(t.count ? 4 : 1, (t.count / maxTrend) * 100)}%` }}
                />
                <span className="text-[10px] text-gray-400 truncate max-w-full">{trend.length <= 14 ? weekday(t.date) : ""}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Open reports */}
        <Card
          title={isEn ? "Open shortage & surplus reports" : "بلاغات نقص وزيادة مفتوحة"}
          subtitle={isEn ? "Need confirmation from the party concerned — live" : "تحتاج تأكيد الطرف المعني — وقتي"}
        >
          {openReports.length === 0 ? (
            <p className="text-sm text-green-600 py-6 text-center">{isEn ? "No open reports 🎉" : "لا توجد بلاغات مفتوحة"}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-2 text-start font-medium">{isEn ? "Order" : "الطلب"}</th>
                    <th className="py-2 text-start font-medium">{isEn ? "Building" : "المبنى"}</th>
                    <th className="py-2 text-start font-medium">{isEn ? "Type" : "النوع"}</th>
                    <th className="py-2 text-start font-medium">{isEn ? "Waiting on" : "بانتظار"}</th>
                    <th className="py-2 text-start font-medium">{isEn ? "Open for" : "مدة الفتح"}</th>
                    <th className="py-2 text-start font-medium">{isEn ? "Action" : "إجراء"}</th>
                  </tr>
                </thead>
                <tbody>
                  {openReports.map((r) => {
                    const owner = stageOwner(r.stageField);
                    const hours = (Date.now() - new Date(r.openedAt).getTime()) / 3_600_000;
                    return (
                      <tr key={r.orderId} className="border-b border-gray-100 last:border-0">
                        <td className="py-2.5">
                          <Link href={`/${locale}/admin/laundry/${r.orderId}`} className="font-semibold text-nassayem hover:underline">
                            {r.orderCode}
                          </Link>
                          {r.isNew && <span className="ms-1.5 text-[10px] font-semibold bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5">{isEn ? "New" : "جديد"}</span>}
                        </td>
                        <td className="py-2.5 text-gray-700">{buildingLabel(r.building, isEn)}</td>
                        <td className="py-2.5 text-gray-700">{kindLabel(r)}</td>
                        <td className="py-2.5 text-gray-700">{isEn ? owner.en : owner.ar}</td>
                        <td className="py-2.5">
                          <span className={`text-xs font-semibold rounded-full px-2 py-1 ${hours >= 4 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{openFor(r.openedAt)}</span>
                        </td>
                        <td className="py-2.5"><SettleButton orderId={r.orderId} locale={locale} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Empty({ isEn }: { isEn: boolean }) {
  return <p className="text-sm text-gray-400 py-6 text-center">{isEn ? "No data for this period" : "لا توجد بيانات لهذه الفترة"}</p>;
}
