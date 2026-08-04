const fs = require("fs");
const path = require("path");

// Manually parse .env to populate DATABASE_URL and DIRECT_URL without extra deps
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function maskPhone(value) {
  if (!value) return "";
  return String(value).replace(/\d[\d\s-]{3,}\d/g, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length <= 4) return m;
    return "•".repeat(digits.length - 4) + digits.slice(-4);
  });
}

function fmtDate(d) {
  if (!d) return "N/A";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return dateObj.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

async function exportConversations() {
  console.log("Fetching conversations from database...");

  // Fetch all real customer conversations with relations
  const conversations = await prisma.chatbotConversation.findMany({
    where: {
      NOT: { externalId: { startsWith: "playground-" } },
      messages: { some: { role: "USER" } },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      leads: true,
      holds: true,
      audit: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${conversations.length} conversations with user messages.`);

  // Collect all reservation references from tool calls
  const refByConv = new Map();
  for (const c of conversations) {
    for (const m of c.messages) {
      if (m.role === "TOOL" && (m.toolName === "create_reservation" || m.toolName === "send_payment_link")) {
        const payload = m.toolPayload;
        const result = payload?.result;
        if (result?.reservation_ref) {
          refByConv.set(c.id, String(result.reservation_ref));
        } else if (result?.reservationNumber) {
          refByConv.set(c.id, String(result.reservationNumber));
        }
      }
    }
  }

  // Fetch payment statuses in one batch
  const allRefs = Array.from(new Set(Array.from(refByConv.values()))).filter(Boolean);
  const payments = allRefs.length
    ? await prisma.netsuitePayment.findMany({
        where: {
          OR: [
            { netsuiteReservationRef: { in: allRefs } },
            { netsuiteReservationId: { in: allRefs } },
          ],
        },
        select: {
          netsuiteReservationRef: true,
          netsuiteReservationId: true,
          status: true,
          amount: true,
          paidAt: true,
        },
      })
    : [];

  const paymentByRef = new Map();
  for (const p of payments) {
    if (p.netsuiteReservationRef) paymentByRef.set(p.netsuiteReservationRef, p);
    if (p.netsuiteReservationId) paymentByRef.set(p.netsuiteReservationId, p);
  }

  // Calculate high-level stats
  const totalConvs = conversations.length;
  const channelStats = { WHATSAPP: 0, WEB: 0 };
  const statusStats = { ACTIVE: 0, ESCALATED: 0, CLOSED: 0 };
  const languageStats = {};
  let totalCustomerMessages = 0;
  let totalBotMessages = 0;
  let totalStaffMessages = 0;
  let totalToolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalReservations = 0;
  let totalPaidReservations = 0;
  let totalLeads = 0;
  let totalHolds = 0;

  for (const c of conversations) {
    if (c.channel === "WHATSAPP") channelStats.WHATSAPP++;
    else if (c.channel === "WEB") channelStats.WEB++;

    if (c.status in statusStats) {
      statusStats[c.status]++;
    }

    languageStats[c.language] = (languageStats[c.language] || 0) + 1;

    for (const m of c.messages) {
      if (m.role === "USER") totalCustomerMessages++;
      else if (m.role === "ASSISTANT") totalBotMessages++;
      else if (m.role === "STAFF") totalStaffMessages++;
      else if (m.role === "TOOL") totalToolCalls++;

      if (m.inputTokens) totalInputTokens += m.inputTokens;
      if (m.outputTokens) totalOutputTokens += m.outputTokens;
    }

    if (refByConv.has(c.id)) {
      totalReservations++;
      const ref = refByConv.get(c.id);
      const payment = paymentByRef.get(ref);
      if (payment && payment.status === "PAID") {
        totalPaidReservations++;
      }
    }

    totalLeads += c.leads.length;
    totalHolds += c.holds.length;
  }

  const out = [];

  // 1. Header & AI Evaluation Guide
  out.push(`# Nassayem Salalah AI Chatbot — Full Conversation Export & Evaluation Dataset`);
  out.push(`_Exported on: ${new Date().toISOString()} | Total Conversations: ${totalConvs}_\n`);
  
  out.push(`## 📌 Purpose & Context for Analyzing AI`);
  out.push(`This dataset contains full customer conversation logs from **Nassayem Salalah (نسائم صلالة)**, a furnished apartment & hospitality rental company in Salalah, Dhofar, Oman.`);
  out.push(`The chatbot handles inquiries across **WhatsApp** and **Web Widget** during regular and Khareef (monsoon) seasons.`);
  out.push(`\n### Key Roles in Transcripts:`);
  out.push(`- **[Customer] (C)**: Inbound message from the guest.`);
  out.push(`- **[AI Assistant] (Bot)**: Automated responses powered by LLM agent.`);
  out.push(`- **[Staff Member] (Staff)**: Human receptionist / manager intervention (handoff mode).`);
  out.push(`- **[Tool Call] (Tool)**: Backend function executed by the agent (unit searches, pricing, availability checks, holding rooms, creating reservations).`);
  out.push(`\n### Suggested Analysis Dimensions for the AI Reviewer:`);
  out.push(`1. **Conversation Flow & Intent Resolution**: Did the bot understand the dates, guest count, and property preferences?`);
  out.push(`2. **Accuracy & Hallucinations**: Did the bot adhere to real tool outputs for prices, amenities, and availability?`);
  out.push(`3. **Conversion & Funnel Progression**: How effectively did the bot guide interested customers to reserving, holding, or paying?`);
  out.push(`4. **Tone, Empathy & Language**: Natural Arabic (Omani/Gulf tone), Arabizi, and English handling; polite, concise, and non-robotic responses.`);
  out.push(`5. **Escalation Logic**: Did it escalate appropriately for edge cases, complaints, discounts, or manual requests without unnecessarily dropping self-service bookings?`);
  out.push(`6. **Recurring Customer Pain Points & Drop-off Causes**: Pricing objections, missing unit types, payment issues, location inquiries, etc.`);
  
  out.push(`\n---\n`);

  // 2. High-level Summary Statistics
  out.push(`## 📊 Global Summary Statistics`);
  out.push(`| Metric | Value |`);
  out.push(`| :--- | :--- |`);
  out.push(`| **Total Analyzed Conversations** | ${totalConvs} |`);
  out.push(`| **WhatsApp Conversations** | ${channelStats.WHATSAPP} |`);
  out.push(`| **Web Widget Conversations** | ${channelStats.WEB} |`);
  out.push(`| **Active / Ongoing** | ${statusStats.ACTIVE} |`);
  out.push(`| **Escalated to Staff** | ${statusStats.ESCALATED} |`);
  out.push(`| **Closed** | ${statusStats.CLOSED} |`);
  out.push(`| **Total Customer Inquiries (Messages)** | ${totalCustomerMessages} |`);
  out.push(`| **Total AI Assistant Replies** | ${totalBotMessages} |`);
  out.push(`| **Total Human Staff Interventions** | ${totalStaffMessages} |`);
  out.push(`| **Total Tool Invocations** | ${totalToolCalls} |`);
  out.push(`| **Reservations Created** | ${totalReservations} |`);
  out.push(`| **Confirmed Paid Reservations** | ${totalPaidReservations} |`);
  out.push(`| **Leads Captured** | ${totalLeads} |`);
  out.push(`| **Room Holds Placed** | ${totalHolds} |`);
  out.push(`| **Token Usage (Approx)** | ${totalInputTokens.toLocaleString()} In / ${totalOutputTokens.toLocaleString()} Out |`);

  out.push(`\n---\n`);
  out.push(`## 💬 Conversation Transcripts\n`);

  // 3. Render Each Conversation
  conversations.forEach((c, index) => {
    const custMsgs = c.messages.filter((m) => m.role === "USER").length;
    const botMsgs = c.messages.filter((m) => m.role === "ASSISTANT").length;
    const staffMsgs = c.messages.filter((m) => m.role === "STAFF").length;
    
    const resRef = refByConv.get(c.id) || null;
    const paymentInfo = resRef ? paymentByRef.get(resRef) : null;
    
    const customerIdentifier = maskPhone(c.customerName || c.externalId || "Unknown");
    const firstMsgAt = c.messages[0]?.createdAt ? fmtDate(c.messages[0].createdAt) : fmtDate(c.createdAt);
    const lastMsgAt = c.messages[c.messages.length - 1]?.createdAt ? fmtDate(c.messages[c.messages.length - 1].createdAt) : fmtDate(c.lastMessageAt);

    out.push(`### Conversation ${index + 1} of ${totalConvs} [ID: \`${c.id}\`]`);
    out.push(`- **Channel**: ${c.channel} | **Customer**: ${customerIdentifier} | **Language**: ${c.language.toUpperCase()}`);
    out.push(`- **Timeline**: ${firstMsgAt} → ${lastMsgAt}`);
    out.push(`- **Status**: ${c.status}${c.aiPaused ? " ⚠️ (AI Paused by Staff)" : ""}${c.escalationReason ? ` | **Escalation Reason**: ${c.escalationReason}` : ""}`);
    out.push(`- **Message Breakdown**: ${custMsgs} Customer, ${botMsgs} Bot, ${staffMsgs} Staff`);

    if (resRef) {
      out.push(`- **Reservation Reference**: \`${resRef}\` | **Payment Status**: **${paymentInfo?.status || "PENDING/UNKNOWN"}**${paymentInfo?.amount ? ` (${paymentInfo.amount} OMR)` : ""}`);
    } else {
      out.push(`- **Reservation**: None`);
    }

    if (c.leads.length > 0) {
      const leadSummary = c.leads.map(l => `${l.name || "Guest"} (${l.status})`).join(", ");
      out.push(`- **Leads Captured**: ${leadSummary}`);
    }

    if (c.holds.length > 0) {
      const holdSummary = c.holds.map(h => `Hold ${h.id.slice(0, 8)} (${h.status})`).join(", ");
      out.push(`- **Room Holds**: ${holdSummary}`);
    }

    if (c.audit) {
      out.push(`- **Audit Verdict**: Outcome: \`${c.audit.outcome}\` | Funnel Stage: \`${c.audit.funnelStage}/8\` | Sentiment: \`${c.audit.sentiment}\`${c.audit.missedBooking ? ` | ⚠️ Missed Booking (${c.audit.missedBookingReason || "Unspecified"})` : ""}`);
      if (c.audit.summary) {
        out.push(`- **Audit Summary**: _${c.audit.summary}_`);
      }
    }

    out.push(`\n**Transcript:**`);
    
    for (const m of c.messages) {
      const timeStr = m.createdAt.toISOString().slice(11, 16);
      const dateStr = m.createdAt.toISOString().slice(5, 10);
      
      if (m.role === "USER") {
        const mediaStr = m.mediaType ? ` 📎 *[Media: ${m.mediaType}${m.mediaUrl ? ` - ${m.mediaUrl}` : ""}]*` : "";
        out.push(`- \`[${dateStr} ${timeStr}]\` 👤 **[Customer]**: ${maskPhone(m.content)}${mediaStr}`);
      } else if (m.role === "ASSISTANT") {
        const mediaStr = m.mediaType ? ` 📎 *[Media: ${m.mediaType}]*` : "";
        out.push(`- \`[${dateStr} ${timeStr}]\` 🤖 **[AI Assistant]**: ${m.content}${mediaStr}`);
      } else if (m.role === "STAFF") {
        const mediaStr = m.mediaType ? ` 📎 *[Media: ${m.mediaType}]*` : "";
        out.push(`- \`[${dateStr} ${timeStr}]\` 👔 **[Staff Member]**: ${maskPhone(m.content)}${mediaStr}`);
      } else if (m.role === "TOOL") {
        let toolDetail = "";
        if (m.toolPayload) {
          try {
            const p = m.toolPayload;
            const inputSnippet = p.input ? `input: ${JSON.stringify(p.input)}` : "";
            const resultSnippet = p.result ? `result: ${JSON.stringify(p.result)}` : "";
            const combined = [inputSnippet, resultSnippet].filter(Boolean).join(" | ");
            toolDetail = combined.length > 500 ? combined.slice(0, 500) + "..." : combined;
          } catch {
            toolDetail = m.content;
          }
        } else {
          toolDetail = m.content;
        }
        out.push(`  > ⚙️ \`[TOOL CALL: ${m.toolName || "system"}]\` ${toolDetail}`);
      }
    }

    out.push(`\n---\n`);
  });

  const outputPath = path.join(process.cwd(), "nassayem-chatbot-conversations.md");
  fs.writeFileSync(outputPath, out.join("\n"), "utf-8");
  const fileSizeMb = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`Successfully exported ${conversations.length} conversations to ${outputPath} (${fileSizeMb} MB)`);
}

exportConversations()
  .catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
