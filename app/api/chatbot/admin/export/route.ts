// ─────────────────────────────────────────────────────────────────────────────
// Bulk conversation export for OFFLINE analysis. Produces ONE downloadable file
// (Markdown by default, JSON optional) of real customer conversations — no AI,
// no tokens spent. You hand the file to an external LLM (Claude, ChatGPT) in a
// single pass to get a performance report: summary, funnel drop-offs, recurring
// mistakes, missed bookings. Far cheaper than the per-conversation in-app audit.
//
// Token-lean by design: tool rows are collapsed to a short summary (never the
// full toolPayload), and phone numbers are masked to the last 4 digits unless
// redact=0. Self-authenticated (middleware skips /api/*); MANAGER + SUPERVISOR
// only, same gate as the admin inbox.
//
// Query params:
//   format=md|json   (default md)
//   channel=WHATSAPP|WEB|ALL   (default ALL)
//   status=ACTIVE|ESCALATED|CLOSED|ALL   (default ALL)
//   from=YYYY-MM-DD  to=YYYY-MM-DD   (filter on lastMessageAt, inclusive)
//   redact=1|0       (default 1 — mask phone numbers)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma, ChatConversationStatus } from "@prisma/client";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REAL_CUSTOMERS = { NOT: { externalId: { startsWith: "playground-" } } };
const STATUSES = ["ACTIVE", "ESCALATED", "CLOSED"] as const;
const CHANNELS = ["WHATSAPP", "WEB"] as const;

/** Mask every digit-run except the last 4 (keeps enough to eyeball-match). */
function maskPhone(value: string): string {
  return value.replace(/\d[\d\s-]{3,}\d/g, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length <= 4) return m;
    return "•".repeat(digits.length - 4) + digits.slice(-4);
  });
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

export async function GET(req: NextRequest) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser || !canViewChatbot(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  const format = p.get("format") === "json" ? "json" : "md";
  const redact = p.get("redact") !== "0";
  const channel = p.get("channel");
  const status = p.get("status");

  // Date window on lastMessageAt (inclusive). Invalid dates are ignored.
  const from = p.get("from") ? new Date(p.get("from") + "T00:00:00Z") : null;
  const to = p.get("to") ? new Date(p.get("to") + "T23:59:59Z") : null;
  const dateFilter: Prisma.DateTimeFilter = {};
  if (from && !isNaN(from.getTime())) dateFilter.gte = from;
  if (to && !isNaN(to.getTime())) dateFilter.lte = to;

  const where: Prisma.ChatbotConversationWhereInput = {
    ...REAL_CUSTOMERS,
    ...(CHANNELS.includes(channel as (typeof CHANNELS)[number])
      ? { channel: channel as (typeof CHANNELS)[number] }
      : {}),
    ...(STATUSES.includes(status as (typeof STATUSES)[number])
      ? { status: status as ChatConversationStatus }
      : {}),
    ...(Object.keys(dateFilter).length ? { lastMessageAt: dateFilter } : {}),
    // Skip empty shells — a conversation with no customer message is noise.
    messages: { some: { role: "USER" } },
  };

  const conversations = await prisma.chatbotConversation.findMany({
    where,
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      leads: {
        select: {
          status: true,
          name: true,
          phone: true,
          idNumber: true,
          reservationNumber: true,
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 1000,
  });

  // ── Deterministic money facts: reservation refs → payment status ────────────
  // Collect every reservation ref across all conversations, then resolve payment
  // status in ONE query (avoids N round-trips).
  const refByConv = new Map<string, string>();
  for (const c of conversations) {
    for (const m of c.messages) {
      if (m.role === "TOOL" && m.toolName === "create_reservation") {
        const result = (m.toolPayload as { result?: { reserved?: boolean; reservation_ref?: string } })
          ?.result;
        if (result?.reserved && result.reservation_ref) {
          refByConv.set(c.id, String(result.reservation_ref));
        }
      }
    }
  }
  const allRefs = [...new Set(refByConv.values())];
  const payments = allRefs.length
    ? await prisma.netsuitePayment.findMany({
        where: {
          OR: [
            { netsuiteReservationRef: { in: allRefs } },
            { netsuiteReservationId: { in: allRefs } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { netsuiteReservationRef: true, netsuiteReservationId: true, status: true },
      })
    : [];
  const statusByRef = new Map<string, string>();
  for (const pay of payments) {
    for (const key of [pay.netsuiteReservationRef, pay.netsuiteReservationId]) {
      if (key && !statusByRef.has(key)) statusByRef.set(key, pay.status);
    }
  }

  const soft = (s: string | null): string => (s == null ? "" : redact ? maskPhone(s) : s);

  // ── JSON export ─────────────────────────────────────────────────────────────
  if (format === "json") {
    const payload = conversations.map((c) => {
      const ref = refByConv.get(c.id) ?? null;
      return {
        id: c.id,
        channel: c.channel,
        externalId: soft(c.externalId),
        customerName: c.customerName,
        language: c.language,
        status: c.status,
        aiPaused: c.aiPaused,
        escalationReason: c.escalationReason,
        createdAt: c.createdAt.toISOString(),
        lastMessageAt: c.lastMessageAt.toISOString(),
        reservationRef: ref,
        paymentStatus: ref ? statusByRef.get(ref) ?? "no_payment_link" : null,
        leads: c.leads.map((l) => ({
          status: l.status,
          name: l.name,
          phone: soft(l.phone),
          idNumber: l.idNumber ? "•••" : null,
          reservationNumber: l.reservationNumber,
        })),
        messages: c.messages.map((m) => ({
          at: m.createdAt.toISOString(),
          role: m.role,
          content: m.role === "TOOL" ? undefined : soft(m.content),
          tool:
            m.role === "TOOL"
              ? { name: m.toolName, summary: soft(m.content).slice(0, 400) }
              : undefined,
          media: m.mediaType ?? undefined,
          tokens:
            m.inputTokens || m.outputTokens
              ? { in: m.inputTokens ?? 0, out: m.outputTokens ?? 0 }
              : undefined,
        })),
      };
    });
    return jsonFile(payload, format);
  }

  // ── Markdown export ─────────────────────────────────────────────────────────
  const out: string[] = [];
  out.push(`# Nassayem chatbot conversations export`);
  out.push(
    `_${conversations.length} conversations` +
      (from || to ? `, ${p.get("from") ?? "…"} → ${p.get("to") ?? "…"}` : "") +
      (redact ? ", phone numbers masked" : "") +
      `._\n`,
  );
  out.push(
    `Legend: **C** = customer, **Bot** = AI, **Staff** = human team member, ` +
      `**[tool]** = internal system call.\n`,
  );

  let totalIn = 0;
  let totalOut = 0;
  conversations.forEach((c, i) => {
    const ref = refByConv.get(c.id) ?? null;
    const pay = ref ? statusByRef.get(ref) ?? "no_payment_link" : null;
    const custMsgs = c.messages.filter((m) => m.role === "USER").length;
    const convIn = c.messages.reduce((s, m) => s + (m.inputTokens ?? 0), 0);
    const convOut = c.messages.reduce((s, m) => s + (m.outputTokens ?? 0), 0);
    totalIn += convIn;
    totalOut += convOut;

    out.push(`\n---\n`);
    out.push(`## Conversation ${i + 1} — ${c.channel} — ${soft(c.customerName || c.externalId)}`);
    const meta = [
      `lang: ${c.language}`,
      `status: ${c.status}${c.aiPaused ? " (AI paused)" : ""}`,
      `messages: ${custMsgs} from customer`,
      `dates: ${fmtDate(c.createdAt)} → ${fmtDate(c.lastMessageAt)}`,
      ref ? `reservation: ${ref} (payment: ${pay})` : `reservation: none`,
      c.escalationReason ? `escalated: ${c.escalationReason}` : null,
      c.leads.length ? `leads: ${c.leads.map((l) => l.status).join(", ")}` : null,
    ].filter(Boolean);
    out.push(`- ${meta.join(" · ")}\n`);

    for (const m of c.messages) {
      const t = m.createdAt.toISOString().slice(11, 16);
      if (m.role === "TOOL") {
        const summary = soft(m.content).slice(0, 300);
        out.push(`> [tool] ${m.toolName}: ${summary}`);
      } else {
        const who = m.role === "USER" ? "**C**" : m.role === "STAFF" ? "**Staff**" : "**Bot**";
        const media = m.mediaType ? ` _(${m.mediaType})_` : "";
        out.push(`\`${t}\` ${who}:${media} ${soft(m.content)}`);
      }
    }
  });

  out.push(`\n---\n`);
  out.push(
    `_Token totals across export: ${totalIn.toLocaleString("en-US")} input, ` +
      `${totalOut.toLocaleString("en-US")} output._`,
  );

  return textFile(out.join("\n"), format);
}

function stamp(): string {
  // Stable-ish filename component from the newest conversation is overkill;
  // the browser dedupes downloads, so a plain base name is fine.
  return "nassayem-chatbot-conversations";
}

function textFile(body: string, format: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stamp()}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}

function jsonFile(payload: unknown, format: string) {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stamp()}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
