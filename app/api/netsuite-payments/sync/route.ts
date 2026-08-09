import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Simple Authorization header check
  const authHeader = req.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.NETSUITE_INBOUND_SECRET || "nidhalghdiri98590405"}`;

  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payments = await prisma.netsuitePayment.findMany({
      select: {
        id: true,
        token: true,
        netsuiteReservationRef: true,
        netsuiteReservationId: true,
        amount: true,
        currency: true,
        status: true,
        netsuiteSyncError: true,
        createdAt: true,
        paidAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Error fetching netsuite payments for sync:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
