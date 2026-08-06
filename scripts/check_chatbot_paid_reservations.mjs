import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== CHECKING CHATBOT RESERVATIONS & PAYMENTS ===\n");

  // 1. Tool calls for create_reservation in ChatbotMessage
  const createResMessages = await prisma.chatbotMessage.findMany({
    where: {
      role: "TOOL",
      toolName: "create_reservation",
    },
    include: {
      conversation: true,
    },
  });

  console.log(`1. Total 'create_reservation' tool executions: ${createResMessages.length}`);

  let successfulResToolCalls = 0;
  let paymentLinksFromBot = [];

  for (const msg of createResMessages) {
    const payload = msg.toolPayload;
    if (payload && payload.result) {
      const res = payload.result;
      if (res.reserved === true || res.payment_url) {
        successfulResToolCalls++;
        // extract token from payment_url if present
        let token = null;
        if (res.payment_url) {
          const parts = res.payment_url.split("/pay/");
          if (parts[1]) token = parts[1].split("?")[0];
        }
        paymentLinksFromBot.push({
          msgId: msg.id,
          conversationId: msg.conversationId,
          customerPhone: msg.conversation.externalId,
          customerName: msg.conversation.customerName,
          reservationRef: res.reservation_ref,
          totalOmr: res.total_omr,
          advanceOmr: res.advance_paid_online_omr,
          paymentUrl: res.payment_url,
          token,
          createdAt: msg.createdAt,
        });
      }
    }
  }

  console.log(`   - Successful online reservation creations (with payment link generated): ${successfulResToolCalls}`);

  // 2. Query NetsuitePayment table for chatbot-created payment links
  // Both via token matching AND via description search
  const allNetsuitePayments = await prisma.netsuitePayment.findMany({
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n2. Total NetsuitePayment records in database: ${allNetsuitePayments.length}`);

  const botTokens = new Set(paymentLinksFromBot.map(p => p.token).filter(Boolean));

  const botPayments = allNetsuitePayments.filter(p => {
    const isBotToken = botTokens.has(p.token);
    const hasBotDesc = p.description && (
      p.description.toLowerCase().includes("chatbot") ||
      p.description.toLowerCase().includes("ai assistant") ||
      p.description.toLowerCase().includes("مساعد")
    );
    return isBotToken || hasBotDesc;
  });

  console.log(`   - NetsuitePayment links created by Chatbot: ${botPayments.length}`);

  const paidBotPayments = botPayments.filter(p => p.status === "PAID");
  const pendingBotPayments = botPayments.filter(p => p.status === "PENDING");
  const expiredBotPayments = botPayments.filter(p => p.status === "EXPIRED");
  const failedBotPayments = botPayments.filter(p => p.status === "FAILED");

  console.log(`\n--- Chatbot Payment Status Breakdown ---`);
  console.log(`- PAID: ${paidBotPayments.length}`);
  console.log(`- PENDING: ${pendingBotPayments.length}`);
  console.log(`- EXPIRED: ${expiredBotPayments.length}`);
  console.log(`- FAILED: ${failedBotPayments.length}`);

  let totalAmountPaid = 0;
  if (paidBotPayments.length > 0) {
    console.log(`\n--- Paid Reservations Details ---`);
    paidBotPayments.forEach((p, i) => {
      totalAmountPaid += p.amount;
      console.log(`[${i+1}] Res Ref: ${p.netsuiteReservationRef || p.netsuiteReservationId}`);
      console.log(`    Customer: ${p.customerName} (${p.customerPhone || 'N/A'})`);
      console.log(`    Amount Paid: ${p.amount} ${p.currency}`);
      console.log(`    Unit Code: ${p.unitCode || 'N/A'}`);
      console.log(`    Check-in: ${p.checkIn?.toISOString().split('T')[0]} -> Check-out: ${p.checkOut?.toISOString().split('T')[0]}`);
      console.log(`    Paid At: ${p.paidAt}`);
      console.log(`    SmartPay Order ID: ${p.smartpayOrderId}`);
      console.log(`    SmartPay Bank Ref: ${p.smartpayBankRefNo}`);
      console.log(`    Description: ${p.description}`);
      console.log(`----------------------------------------`);
    });
    console.log(`Total Paid Amount: ${totalAmountPaid} OMR`);
  }

  // 3. Check ChatbotLead table
  const leadsWithResNumber = await prisma.chatbotLead.findMany({
    where: {
      reservationNumber: { not: null },
    },
    include: {
      conversation: true,
    },
  });

  console.log(`\n3. Chatbot Leads with Reservation Number: ${leadsWithResNumber.length}`);
  for (const lead of leadsWithResNumber) {
    console.log(`   - Lead: ${lead.name} (${lead.phone}) | Res#: ${lead.reservationNumber} | Status: ${lead.status} | Created: ${lead.createdAt.toISOString()}`);
    // Check if there is a NetsuitePayment for this reservation
    const matchingPayment = allNetsuitePayments.find(p => 
      p.netsuiteReservationRef === lead.reservationNumber ||
      p.netsuiteReservationId === lead.reservationNumber ||
      (p.customerPhone && lead.phone && (p.customerPhone.includes(lead.phone.slice(-8)) || lead.phone.includes(p.customerPhone.slice(-8))))
    );
    if (matchingPayment) {
      console.log(`     -> Matching Payment Link found: Status=${matchingPayment.status}, Amount=${matchingPayment.amount} ${matchingPayment.currency}, PaidAt=${matchingPayment.paidAt}`);
    }
  }

  // 4. Check ChatbotConversationAudit table
  const audits = await prisma.chatbotConversationAudit.findMany({
    where: {
      OR: [
        { outcome: "paid" },
        { reservationCreated: true },
        { paymentStatus: "PAID" },
      ],
    },
  });
  console.log(`\n4. Audited conversations with outcome='paid' or reservationCreated=true: ${audits.length}`);
  for (const a of audits) {
    console.log(`   - ConvID: ${a.conversationId} | Outcome: ${a.outcome} | ResCreated: ${a.reservationCreated} | PaymentStatus: ${a.paymentStatus} | Summary: ${a.summary.slice(0, 100)}...`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
