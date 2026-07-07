"use client";

// Two-pane WhatsApp Web layout: conversation list on the start side (right in
// the Arabic admin, left in English), open conversation filling the rest.
// On mobile it behaves like the WhatsApp app: list full-screen at the index
// route, chat full-screen when a conversation is open.

import { usePathname } from "next/navigation";
import ConversationsSidebar from "./ConversationsSidebar";

export default function ConversationsShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const atIndex = /\/admin\/chatbot\/conversations\/?$/.test(pathname ?? "");

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <aside
        className={`w-full lg:w-80 xl:w-96 shrink-0 h-full ${
          atIndex ? "block" : "hidden lg:block"
        }`}
      >
        <ConversationsSidebar locale={locale} />
      </aside>
      <main
        className={`flex-1 h-full min-w-0 overflow-y-auto bg-stone-50 ${
          atIndex ? "hidden lg:block" : "block"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
