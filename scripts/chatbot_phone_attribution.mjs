import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

function getPhoneSuffix(digits) {
  if (!digits || digits.length < 8) return digits;
  return digits.slice(-8);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      row[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(row);
  }
  return rows;
}

function parseAmount(val) {
  if (!val) return 0;
  const clean = val.replace(/OMR/gi, '').replace(/,/g, '').replace(/\"/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

async function main() {
  const [paidPayments, conversations, leads] = await Promise.all([
    prisma.netsuitePayment.findMany({
      where: { status: "PAID" },
      include: { building: true },
      orderBy: { paidAt: "desc" },
    }),
    prisma.chatbotConversation.findMany({
      select: {
        id: true,
        channel: true,
        externalId: true,
        customerName: true,
        createdAt: true,
      },
    }),
    prisma.chatbotLead.findMany({
      select: {
        id: true,
        conversationId: true,
        phone: true,
        name: true,
        reservationNumber: true,
        createdAt: true,
      },
    }),
  ]);

  const convBySuffix = new Map();
  for (const c of conversations) {
    const norm = normalizePhone(c.externalId);
    const suffix = getPhoneSuffix(norm);
    if (suffix && suffix.length >= 7) {
      if (!convBySuffix.has(suffix)) convBySuffix.set(suffix, []);
      convBySuffix.get(suffix).push(c);
    }
  }

  const convById = new Map(conversations.map(c => [c.id, c]));

  for (const l of leads) {
    const norm = normalizePhone(l.phone);
    const suffix = getPhoneSuffix(norm);
    if (suffix && suffix.length >= 7) {
      if (!convBySuffix.has(suffix)) convBySuffix.set(suffix, []);
      const parentConv = convById.get(l.conversationId);
      if (parentConv) convBySuffix.get(suffix).push(parentConv);
    }
  }

  const directBot = [];
  const chatbotAssistedBeforePay = [];
  const contactedBotAfterPay = [];
  const noBotContact = [];

  for (const p of paidPayments) {
    const payNorm = normalizePhone(p.customerPhone);
    const paySuffix = getPhoneSuffix(payNorm);

    const isBotDesc = p.description && (
      p.description.toLowerCase().includes("ai assistant") ||
      p.description.toLowerCase().includes("chatbot") ||
      p.description.toLowerCase().includes("المساعد الذكي")
    );

    const matchingConvs = paySuffix ? (convBySuffix.get(paySuffix) || []) : [];
    const conv = matchingConvs[0] || null;

    if (isBotDesc) {
      directBot.push({ payment: p, conv });
    } else if (conv) {
      const paymentDate = p.paidAt || p.createdAt;
      const firstChatDate = conv.createdAt;

      if (firstChatDate <= paymentDate || (firstChatDate.getTime() - paymentDate.getTime()) < 1000 * 60 * 60 * 24 * 2) {
        chatbotAssistedBeforePay.push({ payment: p, conv });
      } else {
        contactedBotAfterPay.push({ payment: p, conv });
      }
    } else {
      noBotContact.push(p);
    }
  }

  const all95Influenced = [
    ...directBot.map(x => ({ ...x, type: "DIRECT_BOT" })),
    ...chatbotAssistedBeforePay.map(x => ({ ...x, type: "BOT_ASSISTED" }))
  ];

  // Load NetSuite CSV Dataset
  const csvPath = path.resolve("./Chatbot Reservations Dataset.csv");
  const csvRows = parseCSV(csvPath);

  const csvByDocId = new Map();
  for (const r of csvRows) {
    const docId = (r["Document Number/ID"] || "").trim().toUpperCase();
    if (docId) {
      if (!csvByDocId.has(docId)) csvByDocId.set(docId, []);
      csvByDocId.get(docId).push(r);
    }
  }

  let matchedInCsv = 0;
  let totalAdvancePaid = 0;
  let totalFullReservationAmount = 0;
  const detailedResults = [];

  for (const item of all95Influenced) {
    const p = item.payment;
    const amount = Number(p.amount);
    totalAdvancePaid += amount;

    const ref = (p.netsuiteReservationRef || p.netsuiteReservationId || "").trim().toUpperCase();
    let csvRow = null;

    if (ref && csvByDocId.has(ref)) {
      csvRow = csvByDocId.get(ref)[0];
    } else if (ref) {
      for (const [docId, rows] of csvByDocId.entries()) {
        if (docId.includes(ref) || ref.includes(docId)) {
          csvRow = rows[0];
          break;
        }
      }
    }

    if (!csvRow && p.customerPhone) {
      const payPhoneSuffix = getPhoneSuffix(normalizePhone(p.customerPhone));
      if (payPhoneSuffix && payPhoneSuffix.length >= 7) {
        for (const r of csvRows) {
          const entity = r["Entity"] || "";
          const memo = r["Memo"] || "";
          if (normalizePhone(entity).includes(payPhoneSuffix) || normalizePhone(memo).includes(payPhoneSuffix)) {
            csvRow = r;
            break;
          }
        }
      }
    }

    let fullAmount = 0;
    let matchSource = "";

    if (csvRow) {
      matchedInCsv++;
      fullAmount = parseAmount(csvRow["Total Amount (Transaction Currency)"]);
      matchSource = "CSV_DATASET";
    } else {
      if (p.description && p.description.toLowerCase().includes("total")) {
        const m = p.description.match(/total\s+([0-9.]+)\s*OMR/i);
        if (m && m[1]) {
          fullAmount = parseFloat(m[1]);
          matchSource = "PAYMENT_DESCRIPTION_TOTAL";
        }
      }
      if (!fullAmount) {
        fullAmount = amount * 2;
        matchSource = "ESTIMATED_50_PERCENT_ADVANCE";
      }
    }

    totalFullReservationAmount += fullAmount;

    detailedResults.push({
      ref: ref || (csvRow ? csvRow["Document Number/ID"] : "N/A"),
      customerName: p.customerName || (csvRow ? csvRow["Entity"] : "N/A"),
      entity: csvRow ? csvRow["Entity"] : "",
      phone: p.customerPhone,
      advancePaid: amount,
      fullReservationAmount: fullAmount,
      balanceDue: Math.max(0, fullAmount - amount),
      status: (csvRow ? csvRow["Status"] : "Confirmed (Paid)").replace(/Reservation\s*:\s*/i, '').trim(),
      startDate: (csvRow ? csvRow["Start Date"] : (p.checkIn ? new Date(p.checkIn).toISOString().split('T')[0] : "")),
      endDate: (csvRow ? csvRow["End Date"] : (p.checkOut ? new Date(p.checkOut).toISOString().split('T')[0] : "")),
      location: (csvRow ? csvRow["Location"] : null) || p.building?.nameAr || "N/A",
      type: item.type === "DIRECT_BOT" ? "🤖 Bot Direct Link" : "👤 Bot-Assisted (Staff Link)",
      matchSource,
    });
  }

  console.log("================================================================================");
  console.log("                 FULL RESERVATION CONTRACT VALUE (95 RESERVATIONS)              ");
  console.log("================================================================================");
  console.log(`Total Chatbot Influenced Reservations:            ${all95Influenced.length}`);
  console.log(`Matched directly in NetSuite Dataset CSV:        ${matchedInCsv} / ${all95Influenced.length}`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`💳 TOTAL ADVANCE PAID ONLINE (50% Deposit):       ${totalAdvancePaid.toFixed(3)} OMR`);
  console.log(`🏆 TOTAL FULL RESERVATIONS CONTRACT VALUE:        ${totalFullReservationAmount.toFixed(3)} OMR`);
  console.log(`🏨 REMAINING REVENUE DUE AT CHECK-IN:             ${(totalFullReservationAmount - totalAdvancePaid).toFixed(3)} OMR`);
  console.log("================================================================================\n");

  const sorted = [...detailedResults].sort((a, b) => b.fullReservationAmount - a.fullReservationAmount);
  console.log("--- TOP 35 RESERVATIONS BY FULL VALUE ---");
  sorted.slice(0, 35).forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.ref}] ${r.customerName} | Loc: ${r.location} | Status: ${r.status}`);
    console.log(`   Dates: ${r.startDate} -> ${r.endDate} | Advance: ${r.advancePaid.toFixed(3)} OMR | FULL CONTRACT: ${r.fullReservationAmount.toFixed(3)} OMR (Balance Due: ${r.balanceDue.toFixed(3)} OMR)`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
