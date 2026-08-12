import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { sendCustomerSurveyTemplate } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getCurrentAdminUser();
    if (!adminUser || adminUser.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { customerIds } = await req.json();
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const customers = await prisma.campaignCustomer.findMany({
      where: { id: { in: customerIds }, status: "PENDING" },
    });

    if (customers.length === 0) {
      return NextResponse.json({ error: "No pending customers found for given IDs" }, { status: 400 });
    }

    let successCount = 0;

    for (const customer of customers) {
      // Send template
      await sendCustomerSurveyTemplate(customer.phone, customer.name);

      // Create a conversation for them so the webhook knows who they are when they reply
      // The ingest step in the webhook finds this or creates it, but it's good practice.
      // We also log the initial send so it shows in transcripts if needed.
      const conversation = await prisma.chatbotConversation.upsert({
        where: {
          channel_externalId: { channel: "WHATSAPP", externalId: customer.phone },
        },
        update: { language: "ar" },
        create: {
          channel: "WHATSAPP",
          externalId: customer.phone,
          customerName: customer.name,
          language: "ar",
        },
      });

      // Update status
      await prisma.campaignCustomer.update({
        where: { id: customer.id },
        data: { status: "SENT_WAITING" },
      });

      successCount++;
    }

    return NextResponse.json({ success: true, count: successCount }, { status: 200 });
  } catch (error: any) {
    console.error("[campaign/send] Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
