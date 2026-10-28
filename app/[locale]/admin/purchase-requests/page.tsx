import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { buildingLabel } from "@/lib/buildingLabel";
import { getPurchaseRequestUser } from "@/lib/purchaseRequestAccess";
import {
  getPurchaseRequest,
  isPurchaseRequestApiConfigured,
  listPurchaseRequests,
  type PurchaseRequestDetail,
  type PurchaseRequestFailure,
  type PurchaseRequestRow,
  type PurchaseRequestStatus,
} from "@/lib/netsuitePurchaseRequests";
import PurchaseRequestFilters from "@/components/admin/purchase-requests/PurchaseRequestFilters";
import PurchaseRequestList from "@/components/admin/purchase-requests/PurchaseRequestList";
import PurchaseRequestDetailModal from "@/components/admin/purchase-requests/PurchaseRequestDetailModal";

/**
 * Supervisor approval of NetSuite purchase requests.
 *
 * Supervisors have no NetSuite access, so the Supervisor step of the
 * Supervisor → Accounts → GM chain happens here. Accounts and the GM decide
 * inside NetSuite.
 *
 * force-dynamic because every row comes from a live NetSuite call and the page
 * must never be prerendered or cached — see also the `decide` GET, which is
 * confined to the Server Action.
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type TabKey = "pending" | "approved-by-me" | "rejected" | "all";

const TABS: { key: TabKey; en: string; ar: string }[] = [
  { key: "pending", en: "Pending", ar: "قيد الانتظار" },
  { key: "approved-by-me", en: "Approved by me", ar: "اعتمدتها" },
  { key: "rejected", en: "Rejected", ar: "مرفوضة" },
  { key: "all", en: "All", ar: "الكل" },
];

/** Which API status each tab asks for. */
function statusForTab(tab: TabKey): PurchaseRequestStatus | "all" {
  switch (tab) {
    case "pending":
      return "pending_supervisor";
    case "rejected":
      return "rejected";
    // "Approved by me" is filtered locally against the website audit log, so it
    // has to start from every status: an approval of mine may since have moved
    // on to accounts, the GM, or final approval.
    case "approved-by-me":
    case "all":
      return "all";
  }
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    buildingId?: string;
    from?: string;
    to?: string;
    id?: string;
    page?: string;
  }>;
};

/** YYYY-MM-DD guard — anything else is dropped rather than sent to NetSuite. */
function cleanDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 text-center">
      {children}
    </div>
  );
}

/** Shown when NETSUITE_PUR_REQ_API_URL is unset — not an error, just unwired. */
function NotConfiguredState({ isEn }: { isEn: boolean }) {
  return (
    <Card>
      <div className="text-4xl mb-3">⚙️</div>
      <h2 className="font-semibold text-gray-900">
        {isEn ? "Purchase requests are not configured yet" : "طلبات الشراء غير مهيأة بعد"}
      </h2>
      <p className="text-sm text-gray-500 mt-2 max-w-lg mx-auto">
        {isEn
          ? "The NetSuite Purchase Request API URL is missing. Add NETSUITE_PUR_REQ_API_URL to the environment variables, then reload this page."
          : "رابط واجهة طلبات الشراء في NetSuite غير موجود. أضف NETSUITE_PUR_REQ_API_URL إلى متغيرات البيئة ثم أعد تحميل الصفحة."}
      </p>
    </Card>
  );
}

/** NetSuite unreachable, timed out, or refused the call. */
function ApiErrorState({
  failure,
  isEn,
}: {
  failure: PurchaseRequestFailure;
  isEn: boolean;
}) {
  const isAuth = failure.code === "UNAUTHORIZED";
  return (
    <Card>
      <div className="text-4xl mb-3">⚠️</div>
      <h2 className="font-semibold text-gray-900">
        {isAuth
          ? isEn
            ? "NetSuite rejected the connection"
            : "رفض NetSuite الاتصال"
          : isEn
            ? "NetSuite could not be reached"
            : "تعذر الوصول إلى NetSuite"}
      </h2>
      <p className="text-sm text-gray-500 mt-2 max-w-lg mx-auto">
        {isAuth
          ? isEn
            ? "The API token was not accepted. Check NETSUITE_M2M_TOKEN."
            : "لم يتم قبول رمز الواجهة. تحقق من NETSUITE_M2M_TOKEN."
          : isEn
            ? "The request list could not be loaded. This is usually a timeout — try again in a moment."
            : "تعذر تحميل قائمة الطلبات. غالبًا ما يكون ذلك بسبب انتهاء المهلة — حاول مرة أخرى بعد قليل."}
      </p>
      <p className="text-xs text-gray-400 mt-3 font-mono break-all">
        {failure.code}: {failure.error}
      </p>
    </Card>
  );
}

export default async function PurchaseRequestsAdminPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const isEn = locale === "en";

  // Server-side role guard: SUPERVISOR and MANAGER only. The sidebar merely
  // hides the link, so this is what actually protects the page.
  const adminUser = await getPurchaseRequestUser();
  if (!adminUser) {
    redirect(`/${locale}/admin`);
  }

  const tab: TabKey =
    TABS.find((t) => t.key === sp.tab)?.key ?? "pending";
  const buildingId = sp.buildingId?.trim() || "";
  const from = cleanDate(sp.from);
  const to = cleanDate(sp.to);
  const selectedId = sp.id?.trim() || "";
  const pageIndex = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);

  // Buildings that are mapped to NetSuite — Building.netsuiteId holds the same
  // location internal ids as custrecord_pur_req_location. Unmapped buildings
  // can't appear in NetSuite data, so they're not offered as filters.
  const buildings = await prisma.building.findMany({
    where: { netsuiteId: { not: null } },
    select: { id: true, netsuiteId: true, nameEn: true, nameAr: true, shortName: true },
    orderBy: { nameEn: "asc" },
  });

  const buildingOptions = buildings.map((b) => ({
    value: b.netsuiteId as string,
    label: buildingLabel(b, isEn),
  }));

  // The filter value IS the NetSuite location id, so it can be passed straight
  // through — but only if it's a building we actually know, so a hand-edited
  // URL can't probe arbitrary locations.
  const locationIds =
    buildingId && buildingOptions.some((o) => o.value === buildingId)
      ? [buildingId]
      : undefined;

  if (!isPurchaseRequestApiConfigured()) {
    return (
      <PageShell isEn={isEn} locale={locale} tab={tab} counts={null}>
        <NotConfiguredState isEn={isEn} />
      </PageShell>
    );
  }

  // "Approved by me" reads the website audit log rather than paging NetSuite
  // and matching on the supervisor ref — this is what the log is for.
  const myApprovedIds =
    tab === "approved-by-me"
      ? new Set(
          (
            await prisma.purchaseRequestDecision.findMany({
              where: { adminUserId: adminUser.id, decision: "approve" },
              select: { netsuiteRequestId: true },
              orderBy: { createdAt: "desc" },
            })
          ).map((d) => d.netsuiteRequestId),
        )
      : null;

  const listResult = await listPurchaseRequests({
    status: statusForTab(tab),
    locationIds,
    dateFrom: from,
    dateTo: to,
    page: tab === "approved-by-me" ? 0 : pageIndex,
    // The "Approved by me" tab filters after fetching, so it needs a wider
    // window than one page to stay accurate.
    pageSize: tab === "approved-by-me" ? 100 : PAGE_SIZE,
  });

  if (!listResult.ok) {
    return (
      <PageShell isEn={isEn} locale={locale} tab={tab} counts={null}>
        <ApiErrorState failure={listResult} isEn={isEn} />
      </PageShell>
    );
  }

  let rows: PurchaseRequestRow[] = listResult.data.requests;
  let total = listResult.data.total;
  if (myApprovedIds) {
    rows = rows.filter((r) => myApprovedIds.has(r.id));
    total = rows.length;
  }

  // Detail view: fetched server-side so the item lines never need a client
  // round trip, and so the role guard above covers them too.
  let detail: PurchaseRequestDetail | null = null;
  let detailFailure: PurchaseRequestFailure | null = null;
  if (selectedId) {
    const detailResult = await getPurchaseRequest(selectedId);
    if (detailResult.ok) detail = detailResult.data;
    else detailFailure = detailResult;
  }

  const pendingCount =
    tab === "pending" ? total : null;

  return (
    <PageShell
      isEn={isEn}
      locale={locale}
      tab={tab}
      counts={pendingCount}
      filters={
        <PurchaseRequestFilters
          isEn={isEn}
          locale={locale}
          buildingOptions={buildingOptions}
          current={{ tab, buildingId, from: from ?? "", to: to ?? "" }}
        />
      }
    >
      <PurchaseRequestList
        rows={rows}
        isEn={isEn}
        locale={locale}
        tab={tab}
        buildingId={buildingId}
        from={from ?? ""}
        to={to ?? ""}
        page={pageIndex}
        pageSize={PAGE_SIZE}
        total={total}
        /* Paging is NetSuite-side; the client-filtered tab shows one window. */
        paginated={tab !== "approved-by-me"}
      />

      {selectedId && (
        <PurchaseRequestDetailModal
          detail={detail}
          failure={detailFailure}
          isEn={isEn}
          locale={locale}
          /* Only pending_supervisor is actionable on the website. */
          canDecide={detail?.status === "pending_supervisor"}
          closeHref={buildListHref(locale, { tab, buildingId, from, to, page: pageIndex })}
        />
      )}
    </PageShell>
  );
}

/** Builds a list URL that keeps the current tab, filters and page. */
function buildListHref(
  locale: string,
  opts: {
    tab: TabKey;
    buildingId?: string;
    from?: string;
    to?: string;
    page?: number;
  },
): string {
  const qs = new URLSearchParams();
  if (opts.tab !== "pending") qs.set("tab", opts.tab);
  if (opts.buildingId) qs.set("buildingId", opts.buildingId);
  if (opts.from) qs.set("from", opts.from);
  if (opts.to) qs.set("to", opts.to);
  if (opts.page) qs.set("page", String(opts.page));
  const q = qs.toString();
  return `/${locale}/admin/purchase-requests${q ? `?${q}` : ""}`;
}

/** Title + tabs + filter bar, shared by the real page and the empty states. */
function PageShell({
  isEn,
  locale,
  tab,
  counts,
  filters,
  children,
}: {
  isEn: boolean;
  locale: string;
  tab: TabKey;
  counts: number | null;
  filters?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Purchase Requests" : "طلبات الشراء"}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {counts !== null && tab === "pending"
            ? isEn
              ? `${counts} request${counts === 1 ? "" : "s"} waiting for your approval`
              : `${counts} طلب بانتظار اعتمادك`
            : isEn
              ? "Supervisor approval for purchase requests from NetSuite"
              : "اعتماد المشرف لطلبات الشراء من NetSuite"}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => {
          const isActive = t.key === tab;
          return (
            <Link
              key={t.key}
              href={buildListHref(locale, { tab: t.key })}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-nassayem text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-nassayem hover:text-nassayem"
              }`}
            >
              {isEn ? t.en : t.ar}
            </Link>
          );
        })}
      </div>

      {filters}
      {children}
    </div>
  );
}
