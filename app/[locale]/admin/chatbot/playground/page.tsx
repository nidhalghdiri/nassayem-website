import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";
import Playground from "@/components/admin/chatbot/Playground";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

export default async function ChatbotPlaygroundPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  return (
    <div className="p-4 lg:p-8 max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEn ? "Chatbot Playground" : "بيئة تجربة المساعد"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEn
              ? "Test the bot with the live configuration before customers see it. Uses real data (units, prices, availability); leads/holds you create here are real too."
              : "جرّب البوت بالإعدادات الحالية قبل وصولها للعملاء. يستخدم بيانات حقيقية (الوحدات والأسعار والتوفر)."}
          </p>
        </div>
        <Link href={`/${locale}/admin/chatbot`} className="text-sm text-nassayem hover:underline">
          {isEn ? "← Chatbot overview" : "← نظرة عامة"}
        </Link>
      </div>
      <Playground locale={locale} />
    </div>
  );
}
