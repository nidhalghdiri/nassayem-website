import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import type { Prisma, ChatLeadStatus } from "@prisma/client";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";
import LeadStatusSelect from "@/components/admin/chatbot/LeadStatusSelect";
import LeadReservationNumber from "@/components/admin/chatbot/LeadReservationNumber";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: "ALL", en: "All", ar: "الكل" },
  { key: "NEW", en: "New", ar: "جديد" },
  { key: "CONTACTED", en: "Contacted", ar: "تم التواصل" },
  { key: "CONVERTED", en: "Converted", ar: "محوّل" },
  { key: "LOST", en: "Lost", ar: "مفقود" },
] as const;

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function ChatbotLeadsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { status = "ALL" } = await searchParams;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  const where: Prisma.ChatbotLeadWhereInput =
    status !== "ALL" ? { status: status as ChatLeadStatus } : {};

  const [leads, counts] = await Promise.all([
    prisma.chatbotLead.findMany({
      where,
      include: {
        unit: { select: { titleEn: true, titleAr: true } },
        conversation: { select: { id: true, channel: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.chatbotLead.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countFor = (key: string) =>
    key === "ALL"
      ? counts.reduce((s, c) => s + c._count._all, 0)
      : counts.find((c) => c.status === key)?._count._all ?? 0;

  return (
    <div className="p-4 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEn ? "Chatbot Leads" : "العملاء المحتملون"}
        </h1>
        <Link href={`/${locale}/admin/chatbot`} className="text-sm text-nassayem hover:underline">
          {isEn ? "← Chatbot overview" : "← نظرة عامة"}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/${locale}/admin/chatbot/leads?status=${tab.key}`}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              status === tab.key
                ? "bg-nassayem text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {isEn ? tab.en : tab.ar} ({countFor(tab.key)})
          </Link>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-start">{isEn ? "Name" : "الاسم"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Phone" : "الهاتف"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Interest" : "الاهتمام"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Dates" : "التواريخ"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Status" : "الحالة"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Reservation #" : "رقم الحجز"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Created" : "التاريخ"}</th>
                <th className="px-4 py-3 text-start"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    {isEn ? "No leads yet." : "لا يوجد عملاء محتملون بعد."}
                  </td>
                </tr>
              )}
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {lead.name}
                    {lead.notes && (
                      <div className="text-xs text-gray-400 max-w-[220px] truncate" title={lead.notes}>
                        {lead.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`tel:${lead.phone}`} className="text-nassayem hover:underline" dir="ltr">
                      {lead.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {lead.unit ? (isEn ? lead.unit.titleEn : lead.unit.titleAr) : lead.unitInterest || "—"}
                    {lead.guests ? (
                      <div className="text-xs text-gray-400">
                        {lead.guests} {isEn ? "guests" : "ضيوف"}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {lead.checkIn && lead.checkOut
                      ? `${lead.checkIn.toISOString().slice(0, 10)} → ${lead.checkOut.toISOString().slice(0, 10)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusSelect leadId={lead.id} status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <LeadReservationNumber
                      leadId={lead.id}
                      reservationNumber={lead.reservationNumber}
                      isEn={isEn}
                    />
                    {lead.idNumber && (
                      <div className="text-xs text-gray-400 mt-1" dir="ltr">
                        {isEn ? "ID" : "الهوية"}: {lead.idNumber}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {lead.createdAt.toLocaleDateString(isEn ? "en-GB" : "ar-OM", { dateStyle: "medium" })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/chatbot/conversations/${lead.conversation.id}`}
                      className="text-xs text-nassayem hover:underline whitespace-nowrap"
                    >
                      {isEn ? "Transcript" : "المحادثة"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
