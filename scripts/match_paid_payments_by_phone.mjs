import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

function getPhoneSuffix(digits) {
  if (!digits || digits.length < 8) return digits;
  return digits.slice(-8); // match last 8 digits
}

async function main() {
  console.log("=== CROSS-REFERENCING ALL PAID PAYMENTS WITH CHATBOT USERS ===\n");

  // 1. Fetch all PAID NetsuitePayment records
  const paidPayments = await prisma.netsuitePayment.findMany({
    where: { status: "PAID" },
    include: { building: true },
    orderBy: { paidAt: "desc" },
  });

  console.log(`1. Total PAID NetsuitePayment records: ${paidPayments.length}`);

  // 2. Fetch lean chatbot conversations and leads
  const conversations = await prisma.chatbotConversation.findMany({
    select: {
      id: true,
      channel: true,
      externalId: true,
      customerName: true,
      createdAt: true,
      lastMessageAt: true,
    },
  });

  const leads = await prisma.chatbotLead.findMany({
    select: {
      id: true,
      conversationId: true,
      name: true,
      phone: true,
      reservationNumber: true,
      createdAt: true,
    },
  });

  console.log(`2. Total Chatbot Conversations: ${conversations.length}`);
  console.log(`3. Total Chatbot Leads: ${leads.length}\n`);

  // Build lookup maps by last 8 digits
  const convBySuffix = new Map();
  for (const c of conversations) {
    const norm = normalizePhone(c.externalId);
    const suffix = getPhoneSuffix(norm);
    if (suffix && suffix.length >= 7) {
      if (!convBySuffix.has(suffix)) convBySuffix.set(suffix, []);
      convBySuffix.get(suffix).push(c);
    }
  }

  const leadBySuffix = new Map();
  for (const l of leads) {
    const norm = normalizePhone(l.phone);
    const suffix = getPhoneSuffix(norm);
    if (suffix && suffix.length >= 7) {
      if (!leadBySuffix.has(suffix)) leadBySuffix.set(suffix, []);
      leadBySuffix.get(suffix).push(l);
    }
  }

  const matchedItems = [];
  const unmatchedItems = [];

  for (const payment of paidPayments) {
    const payNorm = normalizePhone(payment.customerPhone);
    const paySuffix = getPhoneSuffix(payNorm);

    let matchedConv = null;
    let matchedLead = null;
    let matchType = null;

    if (paySuffix && convBySuffix.has(paySuffix)) {
      matchedConv = convBySuffix.get(paySuffix)[0];
      matchType = "whatsapp_chat";
    } else if (paySuffix && leadBySuffix.has(paySuffix)) {
      matchedLead = leadBySuffix.get(paySuffix)[0];
      matchedConv = conversations.find(c => c.id === matchedLead.conversationId);
      matchType = "chatbot_lead";
    }

    const isBotDesc = payment.description && (
      payment.description.toLowerCase().includes("ai assistant") ||
      payment.description.toLowerCase().includes("chatbot") ||
      payment.description.toLowerCase().includes("المساعد الذكي")
    );

    if (matchedConv || matchedLead || isBotDesc) {
      matchedItems.push({
        payment,
        conv: matchedConv,
        lead: matchedLead,
        matchType: matchType || (isBotDesc ? "direct_bot_description" : "matched"),
        isBotCreated: isBotDesc,
      });
    } else {
      unmatchedItems.push(payment);
    }
  }

  const totalPaidRevenue = paidPayments.reduce((acc, p) => acc + p.amount, 0);
  const chatbotUserRevenue = matchedItems.reduce((acc, m) => acc + m.payment.amount, 0);
  const directBotRevenue = matchedItems.filter(m => m.isBotCreated).reduce((acc, m) => acc + m.payment.amount, 0);
  const staffLinkRevenue = matchedItems.filter(m => !m.isBotCreated).reduce((acc, m) => acc + m.payment.amount, 0);

  console.log("================================================================================");
  console.log("                          CROSS-REFERENCE RESULTS                                ");
  console.log("================================================================================");
  console.log(`Total Paid Payment Links in System:         ${paidPayments.length} (Total: ${totalPaidRevenue.toFixed(3)} OMR)`);
  console.log(`Paid by Customers with Chatbot History:     ${matchedItems.length} (${((matchedItems.length / paidPayments.length) * 100).toFixed(1)}% of all paid reservations)`);
  console.log(`Total Revenue from Chatbot Customers:       ${chatbotUserRevenue.toFixed(3)} OMR (${((chatbotUserRevenue / totalPaidRevenue) * 100).toFixed(1)}% of total revenue)`);
  console.log(`  ├── 🤖 Paid via Chatbot Direct Links:     ${matchedItems.filter(m => m.isBotCreated).length} links (${directBotRevenue.toFixed(3)} OMR)`);
  console.log(`  └── 👤 Paid via Staff Links (after chat): ${matchedItems.filter(m => !m.isBotCreated).length} links (${staffLinkRevenue.toFixed(3)} OMR)`);
  console.log("================================================================================\n");

  console.log("--- ALL PAID RESERVATIONS FROM CUSTOMERS WITH CHATBOT HISTORY ---");
  matchedItems.forEach((m, i) => {
    const p = m.payment;
    const c = m.conv;
    const l = m.lead;
    console.log(`\n#${i + 1} | Res Ref: ${p.netsuiteReservationRef || p.netsuiteReservationId}`);
    console.log(`   Customer: ${p.customerName}`);
    console.log(`   Payment Phone: ${p.customerPhone || 'N/A'}`);
    console.log(`   Chatbot Phone: ${c ? c.externalId : (l ? l.phone : 'N/A')}`);
    console.log(`   Building / Unit: ${p.building?.nameAr || p.buildingId || 'N/A'} - ${p.unitCode || 'N/A'}`);
    console.log(`   Dates: ${p.checkIn ? p.checkIn.toISOString().split('T')[0] : 'N/A'} -> ${p.checkOut ? p.checkOut.toISOString().split('T')[0] : 'N/A'}`);
    console.log(`   Amount Paid: ${p.amount} ${p.currency} (Paid at: ${p.paidAt ? p.paidAt.toISOString() : 'N/A'})`);
    console.log(`   Origin: ${m.isBotCreated ? "🤖 Bot Direct Payment Link" : `👤 Staff Link (Receptionist: ${p.receptionistName || p.receptionistEmail || 'Staff'}) after WhatsApp Chatbot interaction`}`);
    console.log(`   Chatbot First Contact: ${c ? c.createdAt.toISOString() : 'N/A'}`);
    console.log(`   Description: ${p.description || 'N/A'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
