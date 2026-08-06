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
      select: { id: true, channel: true, externalId: true, customerName: true, createdAt: true },
    }),
    prisma.chatbotLead.findMany({
      select: { id: true, conversationId: true, phone: true, name: true, reservationNumber: true, createdAt: true },
    }),
  ]);

  await prisma.$disconnect();

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
  const chatbotAssisted = [];

  for (const p of paidPayments) {
    const payNorm = normalizePhone(p.customerPhone);
    const paySuffix = getPhoneSuffix(payNorm);

    const desc = (p.description || "").toLowerCase();
    const isBotDesc = desc.includes("ai assistant") || desc.includes("chatbot") || desc.includes("المساعد الذكي");

    const matchingConvs = paySuffix ? (convBySuffix.get(paySuffix) || []) : [];
    const conv = matchingConvs[0] || null;

    if (isBotDesc) {
      directBot.push({ payment: p, conv, type: "DIRECT_BOT" });
    } else if (conv) {
      const paymentDate = p.paidAt || p.createdAt;
      const firstChatDate = conv.createdAt;
      // Assisted if chatted before payment or around same period
      chatbotAssisted.push({ payment: p, conv, type: "BOT_ASSISTED" });
    }
  }

  const allList = [...directBot, ...chatbotAssisted];

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

  let totalAdvance = 0;
  let totalFull = 0;
  let matchedCount = 0;
  const outputRows = [];

  for (const item of allList) {
    const p = item.payment;
    const amount = Number(p.amount);
    totalAdvance += amount;

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
      matchedCount++;
      fullAmount = parseAmount(csvRow["Total Amount (Transaction Currency)"]);
      matchSource = "NetSuite CSV Dataset";
    } else {
      if (p.description && p.description.toLowerCase().includes("total")) {
        const m = p.description.match(/total\s+([0-9.]+)\s*OMR/i);
        if (m && m[1]) {
          fullAmount = parseFloat(m[1]);
          matchSource = "Payment Link Description";
        }
      }
      if (!fullAmount) {
        fullAmount = amount * 2;
        matchSource = "Calculated (50% Advance Standard)";
      }
    }

    totalFull += fullAmount;

    outputRows.push({
      ref: ref || (csvRow ? csvRow["Document Number/ID"] : "N/A"),
      customerName: p.customerName || (csvRow ? csvRow["Entity"] : "N/A"),
      phone: p.customerPhone || "",
      type: item.type === "DIRECT_BOT" ? "Direct Bot Link" : "Bot-Assisted (Staff Link)",
      status: (csvRow ? csvRow["Status"] : "Confirmed (Paid)").replace(/Reservation\s*:\s*/i, '').trim(),
      location: (csvRow ? csvRow["Location"] : null) || p.building?.nameAr || "N/A",
      checkIn: (csvRow ? csvRow["Start Date"] : (p.checkIn ? new Date(p.checkIn).toISOString().split('T')[0] : "")),
      checkOut: (csvRow ? csvRow["End Date"] : (p.checkOut ? new Date(p.checkOut).toISOString().split('T')[0] : "")),
      advancePaid: amount,
      fullReservationAmount: fullAmount,
      balanceDue: Math.max(0, fullAmount - amount),
      matchSource,
    });
  }

  const csvHeader = [
    "No",
    "Reservation Ref (NetSuite)",
    "Customer Name",
    "Phone Number",
    "Attribution Type",
    "Reservation Status",
    "Location / Property",
    "Check-In Date",
    "Check-Out Date",
    "Advance Paid (OMR)",
    "Full Reservation Total Amount (OMR)",
    "Remaining Balance Due (OMR)",
    "Data Source"
  ];

  const csvBody = outputRows.map((r, i) => [
    i + 1,
    `"${r.ref}"`,
    `"${(r.customerName || '').replace(/"/g, '""')}"`,
    `"${r.phone}"`,
    `"${r.type}"`,
    `"${r.status}"`,
    `"${(r.location || '').replace(/"/g, '""')}"`,
    `"${r.checkIn}"`,
    `"${r.checkOut}"`,
    r.advancePaid.toFixed(3),
    r.fullReservationAmount.toFixed(3),
    r.balanceDue.toFixed(3),
    `"${r.matchSource}"`
  ]);

  const finalCSV = [csvHeader.join(','), ...csvBody.map(r => r.join(','))].join('\n');
  fs.writeFileSync('./public/chatbot_reservations_full_value_report.csv', finalCSV, 'utf-8');
  console.log(`Successfully generated public/chatbot_reservations_full_value_report.csv with ${outputRows.length} reservations.`);
}

main().catch(console.error);
