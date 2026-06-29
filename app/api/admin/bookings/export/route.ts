import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser, getBuildingScopeFilter } from "@/lib/adminAuth";
import { buildBookingWhere } from "@/lib/adminPaymentFilters";
import { extractSmartpayFields } from "@/lib/smartpayFields";
import { buildExcel, excelHeaders, type ExcelColumn } from "@/lib/excel";

export const dynamic = "force-dynamic";

const COLUMNS: ExcelColumn[] = [
  { header: "Booking #", key: "code", width: 16 },
  { header: "Guest Name", key: "guestName", width: 24 },
  { header: "Email", key: "guestEmail", width: 26 },
  { header: "Phone", key: "guestPhone", width: 16 },
  { header: "Property", key: "property", width: 24 },
  { header: "Building", key: "building", width: 20 },
  { header: "Check-In", key: "checkIn", width: 12 },
  { header: "Check-Out", key: "checkOut", width: 12 },
  { header: "Total (OMR)", key: "total", width: 12 },
  { header: "Amount Paid", key: "amountPaid", width: 12 },
  { header: "Due at Check-In", key: "due", width: 14 },
  { header: "Payment Method", key: "method", width: 14 },
  { header: "Payment Plan", key: "plan", width: 14 },
  { header: "Status", key: "status", width: 12 },
  { header: "Payment Date", key: "paidAt", width: 20 },
  { header: "Order ID", key: "orderId", width: 20 },
  { header: "Tracking ID", key: "trackingId", width: 18 },
  { header: "Bank Ref No", key: "bankRefNo", width: 14 },
  { header: "Card Number", key: "cardNumber", width: 20 },
  { header: "Card Expiry", key: "cardExpiry", width: 12 },
  { header: "Card Type", key: "cardName", width: 12 },
  { header: "Payment Mode", key: "paymentMode", width: 14 },
  { header: "Created At", key: "createdAt", width: 20 },
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

  // Receptionists export only their assigned buildings' bookings.
  const buildingScope = await getBuildingScopeFilter(adminUser);
  const scopeWhere = buildingScope
    ? { unit: { buildingId: buildingScope.buildingId } }
    : {};

  const sp = req.nextUrl.searchParams;
  const where = {
    AND: [
      buildBookingWhere({
        status: sp.get("status") ?? undefined,
        q: sp.get("q") ?? undefined,
        from: sp.get("from") ?? undefined,
        to: sp.get("to") ?? undefined,
      }),
      scopeWhere,
    ],
  };

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: { unit: { include: { building: true } } },
  });

  const rows = bookings.map((b) => {
    const f = extractSmartpayFields(b.smartpayRawResponse);
    return {
      code: b.bookingCode ?? b.id.slice(0, 8).toUpperCase(),
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      guestPhone: b.guestPhone,
      property: b.unit.titleEn,
      building: b.unit.building.nameEn,
      checkIn: fmtDate(b.checkIn),
      checkOut: fmtDate(b.checkOut),
      total: Number(b.totalPrice.toFixed(3)),
      amountPaid: b.amountPaid != null ? Number(b.amountPaid.toFixed(3)) : "",
      due: Number(b.amountDueAtCheckIn.toFixed(3)),
      method: b.paymentMethod,
      plan: b.paymentPlan,
      status: b.status,
      paidAt: fmtDateTime(b.paidAt),
      orderId: f.orderId ?? "",
      trackingId: f.trackingId ?? "",
      bankRefNo: f.bankRefNo ?? "",
      cardNumber: f.cardNumber ?? "",
      cardExpiry: f.cardExpiry ?? "",
      cardName: f.cardName ?? "",
      paymentMode: f.paymentMode ?? "",
      createdAt: fmtDateTime(b.createdAt),
    };
  });

  const stamp = format(new Date(), "yyyy-MM-dd");
  const buffer = await buildExcel("Bookings", COLUMNS, rows);

  return new NextResponse(buffer, {
    headers: excelHeaders(`bookings-${stamp}.xlsx`),
  });
}
