import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

const BASE_URL = "https://graph.facebook.com/v19.0";

function sanitizeName(name) {
  if (!name) return "";
  const cleaned = name.trim();
  // If it's only emojis or symbols or empty
  if (!/[\p{L}\p{N}]/u.test(cleaned)) {
    return "";
  }
  return cleaned;
}

function buildMessage(language, name) {
  const isEn = language === "en";
  const validName = sanitizeName(name);

  if (isEn) {
    const greeting = validName ? `Hello ${validName} 🌿` : `Hello 🌿`;
    return `${greeting}, we sincerely apologize — we experienced a brief technical outage during our chat earlier.\n\nOur team is back online and ready to assist you! Are you still looking to book or would you like to continue your inquiry? 🙏`;
  } else {
    const greeting = validName ? `مرحباً ${validName} 🌿` : `مرحباً بك 🌿`;
    return `${greeting}، نعتذر منك جداً واجهنا انقطاعاً تقنياً مؤقتاً في النظام أثناء محادثتنا السابقة.\n\nفريق نسائم جاهز لخدمتك الآن! هل ما زلت تبحث عن حجز أو ترغب في استكمال استفسارك؟ 🙏`;
  }
}

async function sendWhatsAppText(to, body) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    return { ok: false, error: "Missing WhatsApp credentials" };
  }

  const cleanTo = to.replace(/\D/g, "");
  if (!cleanTo || !body.trim()) {
    return { ok: false, error: "Empty recipient or body" };
  }

  try {
    const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanTo,
        type: "text",
        text: { body: body.slice(0, 4096), preview_url: true },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const rawData = JSON.parse(fs.readFileSync("affected_outage_conversations.json", "utf8"));
  const conversations = rawData.conversations || [];

  console.log(`Loaded ${conversations.length} total affected conversations from export.`);

  // Filter WhatsApp channel and deduplicate by phone number
  const uniqueRecipients = new Map();

  for (const conv of conversations) {
    if (conv.channel !== "WHATSAPP") continue;
    const phone = (conv.phoneNumber || conv.externalId || "").replace(/\D/g, "");
    if (!phone || phone.length < 8) continue;

    if (!uniqueRecipients.has(phone)) {
      uniqueRecipients.set(phone, conv);
    }
  }

  const recipientList = Array.from(uniqueRecipients.values());
  console.log(`Found ${recipientList.length} unique WhatsApp customer phone numbers to message.\n`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < recipientList.length; i++) {
    const item = recipientList[i];
    const phone = item.phoneNumber || item.externalId;
    const messageBody = buildMessage(item.language, item.customerName);

    console.log(`[${i + 1}/${recipientList.length}] Sending to ${item.customerName} (+${phone})...`);

    const sendRes = await sendWhatsAppText(phone, messageBody);

    if (sendRes.ok) {
      successCount++;
      console.log(` -> ✅ Sent successfully.`);

      // Log the message into the database
      try {
        await prisma.chatbotMessage.create({
          data: {
            conversationId: item.conversationId,
            role: "ASSISTANT",
            content: messageBody,
          },
        });
        await prisma.chatbotConversation.update({
          where: { id: item.conversationId },
          data: { lastMessageAt: new Date() },
        });
      } catch (dbErr) {
        console.warn(` -> (DB log note: ${dbErr.message})`);
      }

      results.push({
        phone,
        name: item.customerName,
        conversationId: item.conversationId,
        status: "SUCCESS",
        message: messageBody,
      });
    } else {
      failCount++;
      console.error(` -> ❌ Failed:`, JSON.stringify(sendRes.error));
      results.push({
        phone,
        name: item.customerName,
        conversationId: item.conversationId,
        status: "FAILED",
        error: sendRes.error,
      });
    }

    // Rate limiting: wait 250ms between sends
    await sleep(250);
  }

  console.log(`\n========================================`);
  console.log(`Summary: Total: ${recipientList.length} | Sent: ${successCount} | Failed: ${failCount}`);
  console.log(`========================================`);

  fs.writeFileSync(
    "recovery_send_results.json",
    JSON.stringify(
      {
        sentAt: new Date().toISOString(),
        totalAttempted: recipientList.length,
        successCount,
        failCount,
        results,
      },
      null,
      2
    )
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
