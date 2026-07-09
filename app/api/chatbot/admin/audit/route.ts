// ─────────────────────────────────────────────────────────────────────────────
// Admin-triggered conversation audit runner. Each POST grades a small batch
// (bounded by serverless time limits); the Insights page keeps calling until
// remaining = 0. Manager-only — every call spends model tokens.
//   GET  → { total, audited, remaining }
//   POST → { audited, failed, remaining }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { auditConversation, findAuditCandidates } from "@/lib/chatbot/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 6;
const CONCURRENCY = 2;

export async function GET() {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser || adminUser.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [total, audited, candidates] = await Promise.all([
    prisma.chatbotConversation.count({
      where: {
        NOT: { externalId: { startsWith: "playground-" } },
        messages: { some: { role: "USER" } },
      },
    }),
    prisma.chatbotConversationAudit.count(),
    findAuditCandidates(1),
  ]);
  return NextResponse.json({ total, audited, remaining: candidates.remaining });
}

export async function POST() {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser || adminUser.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { pending } = await findAuditCandidates(BATCH_SIZE);
  let audited = 0;
  let failed = 0;

  // Small concurrent chunks — bounded model calls per invocation.
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const chunk = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map((id) => auditConversation(id)));
    for (const [j, r] of results.entries()) {
      if (r.status === "fulfilled") audited++;
      else {
        failed++;
        console.error(`[chatbot/audit] ${chunk[j]} failed:`, r.reason);
      }
    }
  }

  const { remaining } = await findAuditCandidates(1);
  return NextResponse.json({ audited, failed, remaining });
}
