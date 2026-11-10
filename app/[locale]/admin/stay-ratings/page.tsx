import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { hasManagerAccess } from "@/lib/tasks/constants";
import {
  LOW_SCORE,
  STAY_RATING_VIEWS,
  buildStayRatingWhere,
  parseStayRatingView,
  type StayRatingView,
} from "@/lib/adminStayRatingFilters";
import StayRatingRetryButton from "@/components/admin/StayRatingRetryButton";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; q?: string; building?: string; from?: string; to?: string }>;
};

const TABS: Record<StayRatingView, { en: string; ar: string }> = {
  submitted: { en: "Rated", ar: "تم التقييم" },
  attention: { en: "Needs attention", ar: "تحتاج متابعة" },
  sync: { en: "NetSuite sync issues", ar: "مشاكل المزامنة" },
  waiting: { en: "Waiting for a rating", ar: "بانتظار التقييم" },
  all: { en: "All", ar: "الكل" },
};

const CRITERIA = [
  { key: "cleanliness", en: "Cleanliness", ar: "النظافة" },
  { key: "reception", en: "Reception", ar: "الاستقبال" },
  { key: "facilities", en: "Facilities", ar: "التجهيزات" },
  { key: "value", en: "Value", ar: "القيمة" },
] as const;

const avg = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));

function scoreTone(n: number | null | undefined) {
  if (n == null) return "bg-gray-100 text-gray-400";
  if (n >= 4) return "bg-green-100 text-green-700";
  if (n > LOW_SCORE) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function Score({ n }: { n: number | null }) {
  return (
    <span className={`inline-flex min-w-8 justify-center rounded-md px-1.5 py-0.5 text-xs font-bold ${scoreTone(n)}`}>
      {n ?? "—"}
    </span>
  );
}

export default async function StayRatingsAdminPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const isEn = locale === "en";

  const admin = await getCurrentAdminUser();
  // Guests' phone numbers and comments: managers only (mirrors the sidebar).
  if (!admin || !hasManagerAccess(admin.role)) redirect(`/${locale}/admin`);

  const view = parseStayRatingView(sp.view);
  const where = buildStayRatingWhere(sp, view);
  const ratedWhere = buildStayRatingWhere(sp, "submitted");

  const [rows, tabCounts, totals, recommendYes, byBuilding, buildingRows] = await Promise.all([
    prisma.stayRating.findMany({
      where,
      orderBy: view === "waiting" || view === "all" ? { createdAt: "desc" } : { submittedAt: "desc" },
      take: 200,
    }),
    Promise.all(STAY_RATING_VIEWS.map((v) => prisma.stayRating.count({ where: buildStayRatingWhere(sp, v) }))),
    prisma.stayRating.aggregate({
      where: ratedWhere,
      _count: { _all: true },
      _avg: { cleanliness: true, reception: true, facilities: true, value: true },
    }),
    prisma.stayRating.count({ where: { AND: [ratedWhere, { wouldRecommend: true }] } }),
    prisma.stayRating.groupBy({
      by: ["building"],
      where: ratedWhere,
      _count: { _all: true },
      _avg: { cleanliness: true, reception: true, facilities: true, value: true },
    }),
    prisma.stayRating.findMany({
      where: { building: { not: null } },
      distinct: ["building"],
      select: { building: true },
      orderBy: { building: "asc" },
    }),
  ]);

  const counts = Object.fromEntries(STAY_RATING_VIEWS.map((v, i) => [v, tabCounts[i]])) as Record<StayRatingView, number>;
  const rated = totals._count._all;
  const a = totals._avg;
  const overall =
    rated > 0 && a.cleanliness != null && a.reception != null && a.facilities != null && a.value != null
      ? (a.cleanliness + a.reception + a.facilities + a.value) / 4
      : null;
  const recommendPct = rated > 0 ? Math.round((recommendYes / rated) * 100) : null;

  const rowAvg = (r: (typeof byBuilding)[number]["_avg"]) =>
    r.cleanliness != null && r.reception != null && r.facilities != null && r.value != null
      ? (r.cleanliness + r.reception + r.facilities + r.value) / 4
      : null;
  const buildingStats = byBuilding
    .map((b) => ({ name: b.building ?? (isEn ? "(no building)" : "(بدون مبنى)"), n: b._count._all, avg: rowAvg(b._avg) }))
    .sort((x, y) => (y.avg ?? 0) - (x.avg ?? 0));

  const fmt = (d: Date | null) =>
    d
      ? new Intl.DateTimeFormat(isEn ? "en-GB" : "ar-OM", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Muscat",
        }).format(d)
      : "—";

  const tabHref = (v: StayRatingView) => {
    const p = new URLSearchParams();
    if (v !== "submitted") p.set("view", v);
    for (const k of ["q", "building", "from", "to"] as const) if (sp[k]?.trim()) p.set(k, sp[k]!.trim());
    return `/${locale}/admin/stay-ratings${p.toString() ? `?${p}` : ""}`;
  };

  const syncBadge = (r: (typeof rows)[number]) => {
    if (r.status !== "SUBMITTED") return null;
    const map = {
      SYNCED: { cls: "bg-green-100 text-green-700", en: "In NetSuite", ar: "في NetSuite" },
      PENDING: { cls: "bg-amber-100 text-amber-700", en: "Sync pending", ar: "بانتظار المزامنة" },
      FAILED: { cls: "bg-red-100 text-red-700", en: "Sync failed", ar: "فشلت المزامنة" },
    } as const;
    const s = map[r.nsSyncStatus ?? "PENDING"];
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{isEn ? s.en : s.ar}</span>;
  };

  const inputCls = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-nassayem focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{isEn ? "Stay Ratings" : "تقييمات الإقامة"}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {isEn
            ? "Feedback guests submit after checkout, from the WhatsApp message."
            : "التقييمات التي يرسلها الضيوف بعد المغادرة من رسالة واتساب."}
        </p>
      </div>

      {/* KPIs — rated stays matching the search, building and date filters */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">{isEn ? "Overall average" : "المتوسط العام"}</p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900">
            {avg(overall)}<span className="text-base font-semibold text-gray-400"> / 5</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">{isEn ? `${rated} rated stays` : `${rated} إقامة مُقيَّمة`}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">{isEn ? "Would recommend" : "ينصحون بنا"}</p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900">{recommendPct == null ? "—" : `${recommendPct}%`}</p>
          <p className="mt-1 text-xs text-gray-400">{isEn ? `${recommendYes} of ${rated}` : `${recommendYes} من ${rated}`}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-gray-100 bg-white p-4">
          <p className="mb-2 text-xs text-gray-500">{isEn ? "Average by criterion" : "المتوسط حسب البند"}</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {CRITERIA.map((c) => (
              <div key={c.key}>
                <p className="text-xl font-extrabold text-gray-900">{avg(a[c.key])}</p>
                <p className="text-xs text-gray-400">{isEn ? c.en : c.ar}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {buildingStats.length > 1 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-gray-900">{isEn ? "By building" : "حسب المبنى"}</p>
          <div className="flex flex-wrap gap-2">
            {buildingStats.map((b) => (
              <div key={b.name} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-1.5 text-sm">
                <span className="font-semibold text-gray-700">{b.name}</span>
                <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${scoreTone(b.avg)}`}>{avg(b.avg)}</span>
                <span className="text-xs text-gray-400">({b.n})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {STAY_RATING_VIEWS.map((v) => (
          <Link
            key={v}
            href={tabHref(v)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              v === view
                ? "bg-nassayem text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-600 hover:border-nassayem hover:text-nassayem"
            }`}
          >
            {isEn ? TABS[v].en : TABS[v].ar}
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${v === view ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
              {counts[v]}
            </span>
          </Link>
        ))}
      </div>

      {/* Filters (plain GET form: no client JS) */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        {view !== "submitted" && <input type="hidden" name="view" value={view} />}
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={isEn ? "Guest, phone, reservation, unit…" : "الضيف، الهاتف، الحجز، الشقة…"}
          className={`${inputCls} w-full sm:w-72`}
        />
        <select name="building" defaultValue={sp.building ?? ""} className={inputCls}>
          <option value="">{isEn ? "All buildings" : "كل المباني"}</option>
          {buildingRows.map((b) => (
            <option key={b.building} value={b.building ?? ""}>{b.building}</option>
          ))}
        </select>
        <label className="text-xs text-gray-500">
          {isEn ? "From" : "من"}
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={`${inputCls} mt-1 block`} />
        </label>
        <label className="text-xs text-gray-500">
          {isEn ? "To" : "إلى"}
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={`${inputCls} mt-1 block`} />
        </label>
        <button className="rounded-xl bg-nassayem px-5 py-2 text-sm font-bold text-white hover:bg-nassayem-dark">
          {isEn ? "Apply" : "تطبيق"}
        </button>
        {(sp.q || sp.building || sp.from || sp.to) && (
          <Link href={tabHref(view).split("?")[0] + (view !== "submitted" ? `?view=${view}` : "")} className="py-2 text-sm text-gray-500 underline">
            {isEn ? "Clear" : "مسح"}
          </Link>
        )}
      </form>

      {/* List */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-gray-400">
          {isEn ? "No ratings match." : "لا توجد تقييمات مطابقة."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr className="text-start">
                <th className="px-4 py-3 text-start font-semibold">{isEn ? "Date" : "التاريخ"}</th>
                <th className="px-4 py-3 text-start font-semibold">{isEn ? "Guest" : "الضيف"}</th>
                <th className="px-4 py-3 text-start font-semibold">{isEn ? "Stay" : "الإقامة"}</th>
                {CRITERIA.map((c) => (
                  <th key={c.key} className="px-2 py-3 text-center font-semibold">{isEn ? c.en : c.ar}</th>
                ))}
                <th className="px-2 py-3 text-center font-semibold">{isEn ? "Avg" : "المتوسط"}</th>
                <th className="px-2 py-3 text-center font-semibold">{isEn ? "Recommends" : "ينصح"}</th>
                <th className="px-4 py-3 text-start font-semibold">{isEn ? "Note" : "الملاحظة"}</th>
                <th className="px-4 py-3 text-start font-semibold">NetSuite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const done = r.status === "SUBMITTED";
                const rowAverage =
                  r.cleanliness != null && r.reception != null && r.facilities != null && r.value != null
                    ? (r.cleanliness + r.reception + r.facilities + r.value) / 4
                    : null;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmt(done ? r.submittedAt : r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{r.customerName}</p>
                      <p className="text-xs text-gray-400" dir="ltr">+{r.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{r.building ?? "—"}{r.unitNumbers ? ` · ${r.unitNumbers}` : ""}</p>
                      <p className="text-xs text-gray-400">{r.reservationNumber ?? r.netsuiteReservationId}</p>
                    </td>
                    {done ? (
                      <>
                        <td className="px-2 py-3 text-center"><Score n={r.cleanliness} /></td>
                        <td className="px-2 py-3 text-center"><Score n={r.reception} /></td>
                        <td className="px-2 py-3 text-center"><Score n={r.facilities} /></td>
                        <td className="px-2 py-3 text-center"><Score n={r.value} /></td>
                        <td className="px-2 py-3 text-center">
                          <span className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-bold ${scoreTone(rowAverage)}`}>{avg(rowAverage)}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          {r.wouldRecommend ? (
                            <span className="font-semibold text-green-600">{isEn ? "Yes" : "نعم"}</span>
                          ) : (
                            <span className="font-semibold text-red-600">{isEn ? "No" : "لا"}</span>
                          )}
                        </td>
                        <td className="max-w-xs whitespace-pre-wrap px-4 py-3 text-gray-700">{r.comment || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1.5">
                            {syncBadge(r)}
                            {r.nsSyncStatus === "FAILED" && r.nsSyncError && (
                              <p className="max-w-[16rem] break-words text-xs text-red-600">{r.nsSyncError}</p>
                            )}
                            {r.nsSyncStatus !== "SYNCED" && <StayRatingRetryButton id={r.id} isEn={isEn} />}
                          </div>
                        </td>
                      </>
                    ) : (
                      <td colSpan={8} className="px-4 py-3 text-gray-400">
                        {isEn ? "Waiting for the guest" : "بانتظار الضيف"} ·{" "}
                        {r.waSendStatus === "SENT"
                          ? isEn ? "WhatsApp sent" : "أُرسل واتساب"
                          : r.waSendStatus === "TEST_SENT"
                            ? isEn ? "Test message" : "رسالة اختبار"
                            : isEn ? `WhatsApp ${r.waSendStatus ?? "not sent"}` : `واتساب: ${r.waSendStatus ?? "لم يُرسل"}`}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400">
        {isEn ? "Showing the 200 most recent matches. Dates are in Oman time." : "تُعرض أحدث 200 نتيجة. التواريخ بتوقيت عُمان."}
      </p>
    </div>
  );
}
