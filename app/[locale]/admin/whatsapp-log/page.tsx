import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import WhatsAppLogList from "@/components/admin/WhatsAppLogList";
import ListFilterBar from "@/components/admin/ListFilterBar";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { buildWhatsAppLogWhere } from "@/lib/adminWhatsAppLogFilters";

// The log spans every building and carries customer phone numbers and
// escalation detail, so it stays manager-only (mirrors the sidebar nav).
const ALLOWED_ROLES = ["MANAGER"] as const;

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    kind?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
};

const filterTabs = [
  { key: "all", en: "All", ar: "الكل" },
  { key: "SENT", en: "Sent", ar: "مُرسل" },
  { key: "FAILED", en: "Failed", ar: "فشل" },
  { key: "SKIPPED", en: "Skipped", ar: "متخطى" },
];

const kindOptions = [
  { value: "template", en: "Template", ar: "قالب" },
  { value: "text", en: "Text", ar: "نص" },
  { value: "image", en: "Image", ar: "صورة" },
  { value: "location", en: "Location", ar: "موقع" },
  { value: "contact", en: "Contact", ar: "جهة اتصال" },
];

export default async function WhatsAppLogAdminPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { status: rawStatus, kind, q: searchQuery, from, to } = await searchParams;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  // Server-side role guard: the sidebar only hides the link, so enforce here
  // too in case the URL is hit directly.
  if (!adminUser || !ALLOWED_ROLES.includes(adminUser.role as never)) {
    redirect(`/${locale}/admin`);
  }

  const activeFilter = rawStatus?.toUpperCase() ?? "ALL";
  const where = buildWhatsAppLogWhere({ status: rawStatus, kind, q: searchQuery, from, to });

  const [messages, statusCounts] = await Promise.all([
    prisma.whatsAppMessageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.whatsAppMessageLog.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const countMap: Record<string, number> = { ALL: 0 };
  statusCounts.forEach((c) => {
    countMap[c.status] = c._count.status;
    countMap["ALL"] += c._count.status;
  });

  // Resolve who each number belongs to. Recipients are either staff (an
  // AdminUser.whatsappNumber) or customers (a WhatsApp conversation keyed by
  // externalId) — both are looked up here rather than denormalised onto the log
  // row, so a renamed staff member reads correctly in old rows too.
  const numbers = [...new Set(messages.map((m) => m.to))];
  const [staff, conversations] = await Promise.all([
    prisma.adminUser.findMany({
      where: { whatsappNumber: { in: numbers } },
      select: { name: true, email: true, role: true, whatsappNumber: true },
    }),
    prisma.chatbotConversation.findMany({
      where: { channel: "WHATSAPP", externalId: { in: numbers } },
      select: { id: true, externalId: true, customerName: true },
    }),
  ]);

  const recipients: Record<string, { label: string; sub: string; conversationId?: string }> = {};
  conversations.forEach((c) => {
    recipients[c.externalId] = {
      label: c.customerName ?? (isEn ? "Customer" : "عميل"),
      sub: isEn ? "Customer" : "عميل",
      conversationId: c.id,
    };
  });
  // Staff win over a conversation on the same number: a staff member who also
  // chatted with the bot should still read as staff in the log.
  staff.forEach((s) => {
    if (!s.whatsappNumber) return;
    recipients[s.whatsappNumber] = {
      label: s.name ?? s.email,
      sub: s.role,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "WhatsApp Log" : "سجل واتساب"}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {isEn
            ? `${countMap["ALL"] ?? 0} outbound messages — every template and chatbot reply the system has sent`
            : `${countMap["ALL"] ?? 0} رسالة صادرة — كل القوالب وردود المساعد الذكي التي أرسلها النظام`}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {filterTabs.map((tab) => {
          const isActive = tab.key === "all" ? activeFilter === "ALL" : activeFilter === tab.key;
          const count = countMap[tab.key === "all" ? "ALL" : tab.key] ?? 0;
          // Preserve search + kind + date filters when switching tabs
          const tabParams = new URLSearchParams();
          if (tab.key !== "all") tabParams.set("status", tab.key);
          if (searchQuery?.trim()) tabParams.set("q", searchQuery.trim());
          if (kind) tabParams.set("kind", kind);
          if (from) tabParams.set("from", from);
          if (to) tabParams.set("to", to);
          const href = `/${locale}/admin/whatsapp-log${
            tabParams.toString() ? `?${tabParams}` : ""
          }`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-nassayem text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-nassayem hover:text-nassayem"
              }`}
            >
              {isEn ? tab.en : tab.ar}
              {count > 0 && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Search + type + send-date range + Excel export */}
      <ListFilterBar
        isEn={isEn}
        placeholder={
          isEn
            ? "Search by number, template name, message text..."
            : "بحث بالرقم أو اسم القالب أو نص الرسالة..."
        }
        current={{
          q: searchQuery ?? "",
          from: from ?? "",
          to: to ?? "",
          status: activeFilter,
          kind: kind ?? "",
        }}
        kindOptions={kindOptions.map((k) => ({ value: k.value, label: isEn ? k.en : k.ar }))}
        dateLabels={{
          fromEn: "Sent from",
          fromAr: "أُرسلت من",
          toEn: "Sent to",
          toAr: "أُرسلت إلى",
          hintEn: "Date range filters by send date. Showing the 200 most recent matches.",
          hintAr: "نطاق التاريخ يُصفّي حسب تاريخ الإرسال. تُعرض أحدث 200 نتيجة.",
        }}
        exportPath="/api/admin/whatsapp-log/export"
      />

      <WhatsAppLogList
        messages={messages}
        recipients={recipients}
        isEn={isEn}
        locale={locale}
      />
    </div>
  );
}
