import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, MessagesSquare } from "lucide-react";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

// Index route of the split view — the list (rendered by the layout) is the
// content; this pane just shows an empty state until a chat is opened.
export default async function ConversationsIndexPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-24 h-24 rounded-full bg-white shadow-sm ring-1 ring-black/5 flex items-center justify-center">
        <MessagesSquare className="w-10 h-10 text-nassayem" strokeWidth={1.5} />
      </div>
      <h1 className="mt-6 text-xl font-semibold text-gray-800">
        {isEn ? "Nassayem Messaging" : "مراسلات نسائم"}
      </h1>
      <p className="mt-2 text-sm text-gray-500 max-w-sm leading-relaxed">
        {isEn
          ? "Select a conversation to read it live, reply as the team, or take over from the AI assistant."
          : "اختر محادثة لمتابعتها مباشرة، أو الرد باسم الفريق، أو استلامها من المساعد الذكي."}
      </p>
      <Link
        href={`/${locale}/admin/chatbot/report`}
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-nassayem-dark bg-white ring-1 ring-nassayem/20 hover:bg-nassayem/5 transition-colors"
      >
        <BarChart3 className="w-4 h-4" />
        {isEn ? "Daily executive report" : "التقرير التنفيذي اليومي"}
      </Link>
    </div>
  );
}
