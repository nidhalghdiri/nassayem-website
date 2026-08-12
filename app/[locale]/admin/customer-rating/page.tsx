import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import CustomerRatingModule from "@/components/admin/campaign/CustomerRatingModule";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminCustomerRatingPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const currentAdmin = await getCurrentAdminUser();
  if (!currentAdmin || currentAdmin.role !== "MANAGER") {
    redirect(`/${locale}/admin`);
  }

  // Fetch campaign customers
  const rawCustomers = await prisma.campaignCustomer.findMany({
    orderBy: { createdAt: "desc" },
  });

  const conversations = await prisma.chatbotConversation.findMany({
    where: { channel: "WHATSAPP" },
    select: { id: true, externalId: true },
  });

  const conversationMap = new Map(conversations.map((c) => [c.externalId, c.id]));

  const customers = rawCustomers.map((c) => {
    // Check with and without plus just in case
    let convId = conversationMap.get(c.phone) || conversationMap.get(c.phone.replace("+", "")) || conversationMap.get("+" + c.phone.replace("+", ""));
    return {
      ...c,
      conversationId: convId || null,
      checkinDate: c.checkinDate?.toISOString() ?? null,
      checkoutDate: c.checkoutDate?.toISOString() ?? null,
      stayAmount: c.stayAmount ? Number(c.stayAmount) : null,
      nightRate: c.nightRate ? Number(c.nightRate) : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Customer Ratings Campaign" : "حملة تقييم العملاء"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? "Manage feedback campaigns, upload CSV data, and track WhatsApp surveys."
              : "إدارة حملات التقييم، رفع بيانات العملاء، وتتبع استبيانات الواتساب."}
          </p>
        </div>
      </div>

      <CustomerRatingModule initialCustomers={customers} locale={locale} />
    </div>
  );
}
