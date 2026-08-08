import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

// Index route of the split view — the sidebar (rendered by the layout) is the
// content; this pane just shows an empty state until a chat is opened.
import Link from "next/link";
import { BarChart3 } from "lucide-react";

export default async function ConversationsIndexPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-4">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl shadow-inner border border-blue-100">
        💬
      </div>
      <div>
        <p className="font-bold text-gray-700 text-lg">
          {isEn ? "Live Chatbot Conversations" : "محادثات المساعد الذكي المباشرة"}
        </p>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          {isEn
            ? "Pick a conversation from the sidebar to inspect messages, customer info, and AI tool operations."
            : "اختر محادثة من القائمة الجانبية لقراءة الرسائل وتفاصيل العميل وعمليات المساعد الذكي."}
        </p>
      </div>

      <div className="pt-2">
        <Link
          href={`/${locale}/admin/chatbot/report`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-nassayem text-white hover:bg-nassayem/90 transition-all shadow-sm"
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isEn ? "View Daily Executive Report" : "عرض التقرير التنفيذي اليومي"}</span>
        </Link>
      </div>
    </div>
  );
}
