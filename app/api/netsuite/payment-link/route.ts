/**
 * Inbound API for NetSuite.
 *
 * NetSuite calls this endpoint when the receptionist clicks "Online Payment"
 * on a reservation and enters an amount. We:
 *   1. Verify the shared secret (x-netsuite-secret header).
 *   2. Validate the payload.
 *   3. Create a NetsuitePayment row with a unique token.
 *   4. Return the public payment URL the receptionist can share.
 *
 * Idempotency: if NetSuite retries with the same netsuiteReservationId AND a
 * PENDING link already exists, we return the existing link instead of creating
 * a duplicate. Once the link is PAID/EXPIRED/VOIDED, a new link is created.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { verifyNetsuiteInboundSecret } from "@/lib/netsuite";

const DEFAULT_EXPIRY_HOURS = 72; // 3 days
const MIN_AMOUNT_OMR = 0.001;
const MAX_AMOUNT_OMR = 100_000;

type CreatePaymentLinkBody = {
  netsuiteReservationId: string;
  netsuiteReservationRef?: string;
  unitCode?: string;
  checkIn?: string;  // ISO date
  checkOut?: string; // ISO date
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  amount: number;
  currency?: string;
  description?: string;
  receptionistEmail?: string;
  receptionistName?: string;
  expiryHours?: number;
  locale?: "en" | "ar";
};

function generateToken(): string {
  // 32 random bytes → 43 url-safe base64 chars. Cryptographically unguessable.
  return crypto.randomBytes(32).toString("base64url");
}

function badRequest(message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, details },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  // 1. Auth ────────────────────────────────────────────────────────────────
  const providedSecret = req.headers.get("x-netsuite-secret");
  if (!verifyNetsuiteInboundSecret(providedSecret)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // 2. Parse + validate ────────────────────────────────────────────────────
  let body: CreatePaymentLinkBody;
  try {
    body = (await req.json()) as CreatePaymentLinkBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const {
    netsuiteReservationId,
    netsuiteReservationRef,
    unitCode,
    checkIn,
    checkOut,
    customerName,
    customerPhone,
    customerEmail,
    amount,
    currency = "OMR",
    description,
    receptionistEmail,
    receptionistName,
    expiryHours,
    locale = "en",
  } = body ?? {};

  if (!netsuiteReservationId || typeof netsuiteReservationId !== "string") {
    return badRequest("netsuiteReservationId is required");
  }
  if (!customerName || typeof customerName !== "string") {
    return badRequest("customerName is required");
  }
  if (typeof amount !== "number" || isNaN(amount)) {
    return badRequest("amount must be a number");
  }
  if (amount < MIN_AMOUNT_OMR || amount > MAX_AMOUNT_OMR) {
    return badRequest(
      `amount must be between ${MIN_AMOUNT_OMR} and ${MAX_AMOUNT_OMR} ${currency}`,
    );
  }
  if (currency !== "OMR") {
    return badRequest("Only OMR is supported at this time");
  }

  const hours =
    typeof expiryHours === "number" && expiryHours > 0 && expiryHours <= 720
      ? expiryHours
      : DEFAULT_EXPIRY_HOURS;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  // 3. Idempotency: reuse an active PENDING link for this reservation ──────
  const existing = await prisma.netsuitePayment.findFirst({
    where: {
      netsuiteReservationId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    return NextResponse.json({
      ok: true,
      reused: true,
      paymentLinkId: existing.id,
      token: existing.token,
      url: `${baseUrl}/${locale}/pay/${existing.token}`,
      expiresAt: existing.expiresAt.toISOString(),
    });
  }

  // 4. Create new link ─────────────────────────────────────────────────────
  const token = generateToken();

  const record = await prisma.netsuitePayment.create({
    data: {
      token,
      netsuiteReservationId,
      netsuiteReservationRef: netsuiteReservationRef ?? null,
      unitCode: unitCode ?? null,
      checkIn: checkIn ? new Date(checkIn) : null,
      checkOut: checkOut ? new Date(checkOut) : null,
      customerName: customerName.trim(),
      customerPhone: customerPhone?.trim() || null,
      customerEmail: customerEmail?.trim() || null,
      amount,
      currency,
      description: description?.trim() || null,
      receptionistEmail: receptionistEmail?.trim() || null,
      receptionistName: receptionistName?.trim() || null,
      status: "PENDING",
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return NextResponse.json({
    ok: true,
    reused: false,
    paymentLinkId: record.id,
    token: record.token,
    url: `${baseUrl}/${locale}/pay/${record.token}`,
    expiresAt: record.expiresAt.toISOString(),
  });
}
