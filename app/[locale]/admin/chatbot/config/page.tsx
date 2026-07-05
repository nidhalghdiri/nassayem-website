import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canManageChatbotConfig } from "@/lib/chatbot/permissions";
import { getChatbotSettings, invalidateChatbotSettingsCache } from "@/lib/chatbot/config";
import ConfigForm from "@/components/admin/chatbot/ConfigForm";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

export default async function ChatbotConfigPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canManageChatbotConfig(adminUser.role)) redirect(`/${locale}/admin/chatbot`);

  // Always show the freshest values in the editor (bypass the 60s cache).
  invalidateChatbotSettingsCache();
  const settings = await getChatbotSettings();

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">
        {isEn ? "Chatbot Configuration" : "إعدادات المساعد الذكي"}
      </h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        {isEn
          ? "Changes apply live within ~1 minute — no redeploy needed. Grounding and safety rules are fixed in code and cannot be weakened here."
          : "التغييرات تُطبق مباشرة خلال دقيقة تقريباً — دون إعادة نشر. قواعد الأمان والدقة ثابتة في الكود ولا يمكن تجاوزها من هنا."}
      </p>
      <ConfigForm locale={locale} settings={settings} />
    </div>
  );
}
