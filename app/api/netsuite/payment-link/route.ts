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

// CORS — needed when the call comes from a NetSuite Client Script via fetch().
// The endpoint is protected by the x-netsuite-secret header check, so allowing
// any origin to *attempt* a request is safe; only requests with the right
// secret get a successful response.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-netsuite-secret",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type CreatePaymentLinkBody = {
  netsuiteReservationId: string;
  netsuiteReservationRef?: string;
  // NetSuite building. The live SuiteScript sends `buildingId` (the NetSuite
  // internal id, e.g. "77") plus `buildingName`. `netsuiteBuildingId` is
  // accepted as an alias. We match this against Building.netsuiteId to resolve
  // the website building — it is NOT the website building id itself.
  buildingId?: string | number | null;
  buildingName?: string | null;
  netsuiteBuildingId?: string | number | null;
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
    { status: 400, headers: CORS_HEADERS },
  );
}

function jsonOk<T extends object>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  // Short correlation id so every line for one request can be grep'd together.
  const reqId = crypto.randomBytes(4).toString("hex");
  const tag = `[ns-paylink ${reqId}]`;
  const log = (...args: unknown[]) => console.log(tag, ...args);

  try {
    log("▶ POST received", req.headers.get("origin") ?? "(no origin)");

    // 1. Auth ──────────────────────────────────────────────────────────────
    const providedSecret = req.headers.get("x-netsuite-secret");
    const expectedSecret = process.env.NETSUITE_INBOUND_SECRET;
    log("auth check:", {
      secretConfigured: !!expectedSecret,
      expectedLen: expectedSecret?.length ?? 0,
      headerProvided: !!providedSecret,
      providedLen: providedSecret?.length ?? 0,
      lengthsMatch:
        !!expectedSecret &&
        !!providedSecret &&
        expectedSecret.length === providedSecret.length,
    });
    if (!verifyNetsuiteInboundSecret(providedSecret)) {
      log("✖ 401 Unauthorized — secret missing/mismatch. Aborting (no record created).");
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }
    log("✓ auth ok");

    // 2. Parse + validate ──────────────────────────────────────────────────
    const rawText = await req.text();
    log("raw body:", rawText.slice(0, 2000));
    let body: CreatePaymentLinkBody;
    try {
      body = JSON.parse(rawText) as CreatePaymentLinkBody;
    } catch {
      log("✖ 400 invalid JSON body");
      return badRequest("Invalid JSON body");
    }

    const {
      netsuiteReservationId,
      netsuiteReservationRef,
      buildingId: rawBuildingId,
      netsuiteBuildingId,
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

    log("parsed fields:", {
      netsuiteReservationId,
      netsuiteReservationRef,
      buildingId: rawBuildingId,
      netsuiteBuildingId,
      amount,
      currency,
      customerName,
    });

    if (!netsuiteReservationId || typeof netsuiteReservationId !== "string") {
      log("✖ 400 validation: netsuiteReservationId missing/invalid");
      return badRequest("netsuiteReservationId is required");
    }
    if (!customerName || typeof customerName !== "string") {
      log("✖ 400 validation: customerName missing/invalid");
      return badRequest("customerName is required");
    }
    if (typeof amount !== "number" || isNaN(amount)) {
      log("✖ 400 validation: amount not a number ->", typeof amount, amount);
      return badRequest("amount must be a number");
    }
    if (amount < MIN_AMOUNT_OMR || amount > MAX_AMOUNT_OMR) {
      log("✖ 400 validation: amount out of range ->", amount);
      return badRequest(
        `amount must be between ${MIN_AMOUNT_OMR} and ${MAX_AMOUNT_OMR} ${currency}`,
      );
    }
    if (currency !== "OMR") {
      log("✖ 400 validation: unsupported currency ->", currency);
      return badRequest("Only OMR is supported at this time");
    }
    log("✓ validation passed");

    const hours =
      typeof expiryHours === "number" && expiryHours > 0 && expiryHours <= 720
        ? expiryHours
        : DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    // 3. Idempotency: reuse an active PENDING link for this reservation ────
    // Must be isActive — a soft-deleted (deactivated) link still has status
    // PENDING and a future expiry, but reusing it would return a hidden link
    // and create no new record. Excluding it lets a fresh link be created.
    const existing = await prisma.netsuitePayment.findFirst({
      where: {
        netsuiteReservationId,
        status: "PENDING",
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      log(
        "↩ reusing existing active PENDING link:",
        existing.id,
        "(no new record created)",
      );
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
      return jsonOk({
        ok: true,
        reused: true,
        paymentLinkId: existing.id,
        token: existing.token,
        url: `${baseUrl}/${locale}/pay/${existing.token}`,
        expiresAt: existing.expiresAt.toISOString(),
      });
    }

    // 4. Resolve the website building from the NetSuite building id ────────
    // The live script sends `buildingId`; `netsuiteBuildingId` is an alias. We
    // match the raw NetSuite id against Building.netsuiteId (set in the admin
    // Buildings form). The resolved websiteBuildingId is what receptionist
    // views filter on; null when no id is sent or no building maps to it yet.
    const rawNsBuilding = netsuiteBuildingId ?? rawBuildingId;
    const nsBuildingId =
      rawNsBuilding != null && String(rawNsBuilding).trim() !== ""
        ? String(rawNsBuilding).trim()
        : null;
    let websiteBuildingId: string | null = null;
    if (nsBuildingId) {
      const building = await prisma.building.findUnique({
        where: { netsuiteId: nsBuildingId },
        select: { id: true },
      });
      websiteBuildingId = building?.id ?? null;
    }
    log("building resolution:", {
      nsBuildingId,
      resolvedWebsiteBuildingId: websiteBuildingId,
      matched: !!websiteBuildingId,
    });

    // 5. Create new link ───────────────────────────────────────────────────
    const token = generateToken();

    const record = await prisma.netsuitePayment.create({
      data: {
        token,
        netsuiteReservationId,
        netsuiteReservationRef: netsuiteReservationRef ?? null,
        netsuiteBuildingId: nsBuildingId,
        buildingId: websiteBuildingId,
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
    log("✓ record created:", record.id, "token:", record.token.slice(0, 8) + "…");

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    return jsonOk({
      ok: true,
      reused: false,
      paymentLinkId: record.id,
      token: record.token,
      url: `${baseUrl}/${locale}/pay/${record.token}`,
      expiresAt: record.expiresAt.toISOString(),
    });
  } catch (err) {
    // Anything unexpected (e.g. DB error) — log it instead of failing silently.
    console.error(`${tag} ✖ UNHANDLED ERROR:`, err);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
