"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateLeadStatus } from "@/app/actions/chatbot";
import type { ChatLeadStatus } from "@prisma/client";

const STATUS_STYLES: Record<ChatLeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  LOST: "bg-gray-100 text-gray-600",
};

export default function LeadStatusSelect({
  leadId,
  status,
}: {
  leadId: string;
  status: ChatLeadStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          await updateLeadStatus(leadId, e.target.value as ChatLeadStatus);
          router.refresh();
        })
      }
      className={`rounded-full px-2 py-1 text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-nassayem/50 ${STATUS_STYLES[status]} disabled:opacity-50`}
    >
      <option value="NEW">NEW</option>
      <option value="CONTACTED">CONTACTED</option>
      <option value="CONVERTED">CONVERTED</option>
      <option value="LOST">LOST</option>
    </select>
  );
}
