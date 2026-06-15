import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser, getBuildingScopeFilter } from "@/lib/adminAuth";
import { buildNetsuiteWhere } from "@/lib/adminPaymentFilters";
import { extractSmartpayFields } from "@/lib/smartpayFields";
import { buildExcel, excelHeaders, type ExcelColumn } from "@/lib/excel";

export const dynamic = "force-dynamic";

const COLUMNS: ExcelColumn[] = [
  { header: "Reservation Ref", key: "ref", width: 18 },
  { header: "Reservation ID", key: "resId", width: 18 },
  { header: "Building", key: "building", width: 22 },
  { header: "Unit Code", key: "unitCode", width: 12 },
  { header: "Customer Name", key: "customerName", width: 24 },
  { header: "Email", key: "customerEmail", width: 26 },
  { header: "Phone", key: "customerPhone", width: 16 },
  { header: "Amount", key: "amount", width: 12 },
  { header: "Currency", key: "currency", width: 10 },
  { header: "Status", key: "status", width: 12 },
  { header: "Active", key: "active", width: 8 },
  { header: "Check-In", key: "checkIn", width: 12 },
  { header: "Check-Out", key: "checkOut", width: 12 },
  { header: "Payment Date", key: "paidAt", width: 20 },
  { header: "Order ID", key: "orderId", width: 20 },
  { header: "Tracking ID", key: "trackingId", width: 18 },
  { header: "Bank Ref No", key: "bankRefNo", width: 14 },
  { header: "Card Number", key: "cardNumber", width: 20 },
  { header: "Card Expiry", key: "cardExpiry", width: 12 },
  { header: "Card Type", key: "cardName", width: 12 },
  { header: "Payment Mode", key: "paymentMode", width: 14 },
  { header: "Created At", key: "createdAt", width: 20 },
  { header: "Synced to NetSuite", key: "syncedAt", width: 20 },
];

const fmtDate = (d: Date | null | undefined) =>
  d ? format(d, "yyyy-MM-dd") : "";
const fmtDateTime = (d: Date | null | undefined) =>
  d ? format(d, "yyyy-MM-dd HH:mm:ss") : "";

export async function GET(req: NextRequest) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (adminUser.role !== "MANAGER" && adminUser.role !== "RECEPTIONIST") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Receptionists may only export rows for their assigned buildings.
  const scope = await getBuildingScopeFilter(adminUser);

  const sp = req.nextUrl.searchParams;
  const where = {
    ...buildNetsuiteWhere({
      status: sp.get("status") ?? undefined,
      q: sp.get("q") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    }),
    ...(scope ?? {}),
  };

  const payments = await prisma.netsuitePayment.findMany({
    where,
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: { building: { select: { nameEn: true } } },
  });

  const rows = payments.map((p) => {
    const f = extractSmartpayFields(p.smartpayRawResponse);
    return {
      ref: p.netsuiteReservationRef ?? "",
      resId: p.netsuiteReservationId,
      building: p.building?.nameEn ?? "",
      unitCode: p.unitCode ?? "",
      customerName: p.customerName,
      customerEmail: p.customerEmail ?? "",
      customerPhone: p.customerPhone ?? "",
      amount: Number(p.amount.toFixed(3)),
      currency: p.currency,
      status: p.status,
      active: p.isActive ? "Yes" : "No",
      checkIn: fmtDate(p.checkIn),
      checkOut: fmtDate(p.checkOut),
      paidAt: fmtDateTime(p.paidAt),
      orderId: f.orderId ?? p.smartpayOrderId ?? "",
      trackingId: f.trackingId ?? "",
      bankRefNo: f.bankRefNo ?? p.smartpayBankRefNo ?? "",
      cardNumber: f.cardNumber ?? "",
      cardExpiry: f.cardExpiry ?? "",
      cardName: f.cardName ?? "",
      paymentMode: f.paymentMode ?? "",
      createdAt: fmtDateTime(p.createdAt),
      syncedAt: fmtDateTime(p.netsuiteSyncedAt),
    };
  });

  const stamp = format(new Date(), "yyyy-MM-dd");
  const buffer = await buildExcel("NetSuite Payments", COLUMNS, rows);

  return new NextResponse(buffer, {
    headers: excelHeaders(`netsuite-payments-${stamp}.xlsx`),
  });
}
