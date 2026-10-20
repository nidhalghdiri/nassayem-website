"use client";

// Two-pane WhatsApp Web layout: conversation list on the start side (right in
// the Arabic admin, left in English), open conversation filling the rest.
// On mobile it behaves like the WhatsApp app: list full-screen at the index
// route, chat full-screen when a conversation is open.
// The negative margins cancel the admin page padding so the inbox runs edge
// to edge and uses the whole viewport below the admin header.

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
    <div className="-m-4 md:-m-8 flex h-[calc(100dvh-58px)] lg:h-[calc(100dvh-4rem)] overflow-hidden bg-white">
      <aside
        className={`w-full lg:w-[340px] xl:w-[380px] shrink-0 h-full ${
          atIndex ? "block" : "hidden lg:block"
        }`}
      >
        <ConversationsSidebar locale={locale} />
      </aside>
      <main
        className={`flex-1 h-full min-w-0 overflow-hidden bg-[#f4f1ec] ${
          atIndex ? "hidden lg:block" : "block"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
