import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  try {
    const adminUser = await getCurrentAdminUser();
    if (!adminUser || adminUser.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { customerIds, categoryId } = await req.json();
    if (!Array.isArray(customerIds) || customerIds.length === 0 || !categoryId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await prisma.campaignCustomer.updateMany({
      where: { id: { in: customerIds } },
      data: { categoryId }
    });

    return NextResponse.json({ success: true, count: result.count }, { status: 200 });
  } catch (error: any) {
    console.error("[campaign/category/assign] POST Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
