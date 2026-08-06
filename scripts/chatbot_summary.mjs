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
  return digits.slice(-8);
}

async function main() {
  const paidPayments = await prisma.netsuitePayment.findMany({
    where: { status: "PAID" },
    include: { building: true },
    orderBy: { paidAt: "desc" },
  });

  const conversations = await prisma.chatbotConversation.findMany({
    select: {
      id: true,
      channel: true,
      externalId: true,
      customerName: true,
      createdAt: true,
      lastMessageAt: true,
      leads: {
        select: {
          id: true,
          phone: true,
          name: true,
          reservationNumber: true,
          createdAt: true,
        },
      },
    },
  });

  const convBySuffix = new Map();
  for (const c of conversations) {
    const norm = normalizePhone(c.externalId);
    const suffix = getPhoneSuffix(norm);
    if (suffix && suffix.length >= 7) {
      if (!convBySuffix.has(suffix)) convBySuffix.set(suffix, []);
      convBySuffix.get(suffix).push(c);
    }
    for (const l of c.leads) {
      const leadNorm = normalizePhone(l.phone);
      const leadSuffix = getPhoneSuffix(leadNorm);
      if (leadSuffix && leadSuffix.length >= 7) {
        if (!convBySuffix.has(leadSuffix)) convBySuffix.set(leadSuffix, []);
        convBySuffix.get(leadSuffix).push(c);
      }
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

  const sumAmount = (arr) => arr.reduce((acc, x) => acc + (x.payment ? x.payment.amount : x.amount), 0);

  console.log("=== FINAL SUMMARY NUMBERS ===");
  console.log(`Total Paid Payments: ${paidPayments.length} | Amount: ${sumAmount(paidPayments).toFixed(3)} OMR`);
  console.log(`1. Direct Chatbot Links: ${directBot.length} | Amount: ${sumAmount(directBot).toFixed(3)} OMR`);
  console.log(`2. Chatbot-Assisted (Chat before Pay): ${chatbotAssistedBeforePay.length} | Amount: ${sumAmount(chatbotAssistedBeforePay).toFixed(3)} OMR`);
  console.log(`TOTAL INFLUENCED BY CHATBOT: ${directBot.length + chatbotAssistedBeforePay.length} | Amount: ${(sumAmount(directBot) + sumAmount(chatbotAssistedBeforePay)).toFixed(3)} OMR`);
  console.log(`3. Returning Guests (Chat after Pay): ${contactedBotAfterPay.length} | Amount: ${sumAmount(contactedBotAfterPay).toFixed(3)} OMR`);
  console.log(`4. Direct / Staff Only (No Chatbot): ${noBotContact.length} | Amount: ${sumAmount(noBotContact).toFixed(3)} OMR`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
