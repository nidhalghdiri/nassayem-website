// ─────────────────────────────────────────────────────────────────────────────
// Programmatic NetsuitePayment link creation — used by the chatbot after it
// creates a reservation in NetSuite, so the customer can pay by card
// immediately in the chat. Mirrors the core of the battle-tested inbound API
// (app/api/netsuite/payment-link/route.ts) which stays untouched: same
// idempotency rule (reuse an active PENDING link per reservation), same
// building resolution via Building.netsuiteId, same token scheme, and the
// same /pay/[token] page + SmartPay webhook + NetSuite sync downstream.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import prisma from "@/lib/prisma";

const DEFAULT_EXPIRY_HOURS = 72;

export type PaymentLinkInput = {
  netsuiteReservationId: string;
  netsuiteReservationRef?: string | null;
  netsuiteBuildingId?: string | null;
  unitCode?: string | null;
  checkIn?: string | null; // ISO date
  checkOut?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  amount: number; // OMR
  description?: string | null;
  expiryHours?: number;
  locale?: "en" | "ar";
};

export type PaymentLinkResult = {
  paymentLinkId: string;
  url: string;
  expiresAt: Date;
  reused: boolean;
};

export async function createNetsuitePaymentLink(
  input: PaymentLinkInput,
): Promise<PaymentLinkResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const locale = input.locale ?? "en";

  // Idempotency — reuse an active PENDING link for the same reservation.
  const existing = await prisma.netsuitePayment.findFirst({
    where: {
      netsuiteReservationId: input.netsuiteReservationId,
      status: "PENDING",
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return {
      paymentLinkId: existing.id,
      url: `${baseUrl}/${locale}/pay/${existing.token}`,
      expiresAt: existing.expiresAt,
      reused: true,
    };
  }

  // Resolve the website building from the NetSuite building id.
  let websiteBuildingId: string | null = null;
  if (input.netsuiteBuildingId) {
    const building = await prisma.building.findUnique({
      where: { netsuiteId: String(input.netsuiteBuildingId) },
      select: { id: true },
    });
    websiteBuildingId = building?.id ?? null;
  }

  const hours =
    input.expiryHours && input.expiryHours > 0 && input.expiryHours <= 720
      ? input.expiryHours
      : DEFAULT_EXPIRY_HOURS;

  const record = await prisma.netsuitePayment.create({
    data: {
      token: crypto.randomBytes(32).toString("base64url"),
      netsuiteReservationId: input.netsuiteReservationId,
      netsuiteReservationRef: input.netsuiteReservationRef ?? null,
      netsuiteBuildingId: input.netsuiteBuildingId ?? null,
      buildingId: websiteBuildingId,
      unitCode: input.unitCode ?? null,
      checkIn: input.checkIn ? new Date(input.checkIn) : null,
      checkOut: input.checkOut ? new Date(input.checkOut) : null,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone?.trim() || null,
      customerEmail: input.customerEmail?.trim() || null,
      amount: input.amount,
      currency: "OMR",
      description: input.description?.trim() || null,
      status: "PENDING",
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    },
  });

  return {
    paymentLinkId: record.id,
    url: `${baseUrl}/${locale}/pay/${record.token}`,
    expiresAt: record.expiresAt,
    reused: false,
  };
}
