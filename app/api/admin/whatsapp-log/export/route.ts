import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { buildWhatsAppLogWhere } from "@/lib/adminWhatsAppLogFilters";
import { buildExcel, excelHeaders, type ExcelColumn } from "@/lib/excel";

export const dynamic = "force-dynamic";

const COLUMNS: ExcelColumn[] = [
  { header: "Date", key: "date", width: 12 },
  { header: "Time", key: "time", width: 10 },
  { header: "To", key: "to", width: 16 },
  { header: "Recipient", key: "recipient", width: 24 },
  { header: "Recipient Type", key: "recipientType", width: 16 },
  { header: "Type", key: "kind", width: 10 },
  { header: "Template", key: "templateName", width: 26 },
  { header: "Language", key: "language", width: 10 },
  { header: "Status", key: "status", width: 10 },
  { header: "Details", key: "details", width: 60 },
  { header: "Media URL", key: "mediaUrl", width: 40 },
  { header: "WhatsApp Message ID", key: "waMessageId", width: 34 },
  { header: "Error", key: "error", width: 40 },
];

export async function GET(req: NextRequest) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Manager-only, mirroring the page guard: the log spans every building and
  // carries customer phone numbers.
  if (adminUser.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const where = buildWhatsAppLogWhere({
    status: sp.get("status") ?? undefined,
    kind: sp.get("kind") ?? undefined,
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });

  const messages = await prisma.whatsAppMessageLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Resolve recipient identities in bulk — same approach as the page.
  const numbers = [...new Set(messages.map((m) => m.to))];
  const [staff, conversations] = await Promise.all([
    prisma.adminUser.findMany({
      where: { whatsappNumber: { in: numbers } },
      select: { name: true, email: true, role: true, whatsappNumber: true },
    }),
    prisma.chatbotConversation.findMany({
      where: { channel: "WHATSAPP", externalId: { in: numbers } },
      select: { externalId: true, customerName: true },
    }),
  ]);
  const recipients: Record<string, { label: string; type: string }> = {};
  conversations.forEach((c) => {
    recipients[c.externalId] = { label: c.customerName ?? "", type: "Customer" };
  });
  staff.forEach((s) => {
    if (s.whatsappNumber) recipients[s.whatsappNumber] = { label: s.name ?? s.email, type: s.role };
  });

  const rows = messages.map((m) => {
    const params = Array.isArray(m.bodyParams) ? (m.bodyParams as string[]) : [];
    const details = m.kind === "template" ? params.join(" | ") : (m.body ?? "");
    const r = recipients[m.to];
    return {
      date: format(m.createdAt, "yyyy-MM-dd"),
      time: format(m.createdAt, "HH:mm:ss"),
      to: m.to,
      recipient: r?.label ?? "",
      recipientType: r?.type ?? "Unknown",
      kind: m.kind,
      templateName: m.templateName ?? "",
      language: m.language ?? "",
      status: m.status,
      details,
      mediaUrl: m.mediaUrl ?? "",
      waMessageId: m.waMessageId ?? "",
      error: m.error ?? "",
    };
  });

  const stamp = format(new Date(), "yyyy-MM-dd");
  const buffer = await buildExcel("WhatsApp Log", COLUMNS, rows);

  return new NextResponse(buffer, {
    headers: excelHeaders(`whatsapp-log-${stamp}.xlsx`),
  });
}
