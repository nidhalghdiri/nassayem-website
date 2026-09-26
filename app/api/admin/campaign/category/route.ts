import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getCurrentAdminUser();
    if (!adminUser || adminUser.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, whatsappTemplateId } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const category = await prisma.customerCategory.create({
      data: {
        name,
        whatsappTemplateId: whatsappTemplateId || null,
      }
    });

    return NextResponse.json(category, { status: 200 });
  } catch (error: any) {
    console.error("[campaign/category] POST Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
