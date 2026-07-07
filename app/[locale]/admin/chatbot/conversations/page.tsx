import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

// Index route of the split view — the sidebar (rendered by the layout) is the
// content; this pane just shows an empty state until a chat is opened.
export default async function ConversationsIndexPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-3xl mb-4">
        💬
      </div>
      <p className="font-medium text-gray-500">
        {isEn ? "Select a conversation" : "اختر محادثة"}
      </p>
      <p className="text-sm mt-1">
        {isEn
          ? "Pick a chat from the list to read it and reply."
          : "اختر محادثة من القائمة لقراءتها والرد عليها."}
      </p>
    </div>
  );
}
