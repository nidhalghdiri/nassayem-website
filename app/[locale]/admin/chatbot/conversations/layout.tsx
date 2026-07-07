import ConversationsShell from "@/components/admin/chatbot/ConversationsShell";

// WhatsApp-style split view for the chatbot inbox: the live sidebar persists
// across conversation navigation, so switching chats only swaps the detail
// pane. Auth lives in the pages (they redirect); the sidebar's API endpoint
// is admin-gated itself.
export default async function ConversationsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ConversationsShell locale={locale}>{children}</ConversationsShell>;
}
