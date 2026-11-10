/**
 * Inbound API for NetSuite — guest checked out, send the stay-feedback WhatsApp.
 *
 * The ns_ue_reservation user event POSTs one event when a reservation's status
 * becomes CheckedOut. We:
 *   1. Verify the shared secret (Authorization: Bearer or x-nassayem-secret,
 *      checked against NETSUITE_CHECKOUT_NOTIFY_SECRET). NetSuite's server-side
 *      N/https drops x-netsuite-* headers, so those two are used instead.
 *   2. Validate the payload.
 *   3. Create (or reuse) the StayRating row — unique per reservation, so a
 *      repeated event never creates a second link.
 *   4. Send the ns_stay_feedback template with the row's token as the button
 *      suffix. A reservation whose message already went out is not re-sent.
 *
 * Answers 200 with { ok, sent, ... } once authenticated and valid; a failed
 * WhatsApp send is recorded on the row and in WhatsAppMessageLog, not turned
 * into a 500. NetSuite sets custbody_ns_fb_sent only when `sent` is true, so a
 * failed send can be re-triggered.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCheckoutNotifySecret } from "@/lib/netsuite";
import { notifyStayFeedback } from "@/lib/whatsapp";
import { generateRatingToken } from "@/lib/stayRating";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-nassayem-secret",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type CheckoutBody = {
  reservationId?: string | number;
  reservationNumber?: string;
  customerName?: string;
  phone?: string;
  building?: string;
  /** Unit names — an array, or one already-joined string. */
  units?: string[] | string;
  checkoutDate?: string;
  language?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

const text = (v: unknown, max = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function POST(req: NextRequest) {
  try {
    const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const providedSecret =
      bearer ?? req.headers.get("x-nassayem-secret") ?? req.headers.get("x-netsuite-secret");
    if (!verifyCheckoutNotifySecret(providedSecret)) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    let body: CheckoutBody;
    try {
      body = (await req.json()) as CheckoutBody;
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const reservationId = text(body?.reservationId, 50);
    const customerName = text(body?.customerName);
    const phone = text(body?.phone, 30);
    if (!/^\d+$/.test(reservationId)) {
      return json({ ok: false, error: "reservationId is required (digits)" }, 400);
    }
    if (!customerName) return json({ ok: false, error: "customerName is required" }, 400);
    if (phone.replace(/\D/g, "") === "") {
      // Not an error worth a retry: this guest simply has no number on file.
      return json({ ok: true, sent: false, reason: "no-phone" });
    }

    const building = text(body.building);
    const unitNumbers = (Array.isArray(body.units) ? body.units.map((u) => text(u, 50)) : [text(body.units)])
      .filter(Boolean)
      .join("، ")
      .slice(0, 200);
    const checkoutDate = body.checkoutDate ? new Date(body.checkoutDate) : null;
    const language = body.language === "en" ? "en" : "ar";

    // Create-or-reuse. The unique key makes a double event harmless; the token
    // is only set on create, so a re-sent message keeps the same link.
    const row = await prisma.stayRating.upsert({
      where: { netsuiteReservationId: reservationId },
      create: {
        token: generateRatingToken(),
        netsuiteReservationId: reservationId,
        reservationNumber: text(body.reservationNumber, 50) || null,
        customerName,
        phone: phone.replace(/\D/g, ""),
        building: building || null,
        unitNumbers: unitNumbers || null,
        checkoutDate: checkoutDate && !isNaN(checkoutDate.getTime()) ? checkoutDate : null,
        language,
      },
      update: {},
    });

    if (row.waSendStatus === "SENT" || row.status === "SUBMITTED") {
      return json({ ok: true, sent: true, alreadySent: true });
    }

    // Test mode: while STAY_FEEDBACK_TEST_PHONE is set, every message goes to
    // that number instead of the guest's. Remove the variable to go live.
    const testPhone = (process.env.STAY_FEEDBACK_TEST_PHONE ?? "").replace(/\D/g, "");
    const result = await notifyStayFeedback({
      to: testPhone || row.phone,
      name: row.customerName.split(" ")[0] ?? row.customerName,
      building: row.building ?? "",
      token: row.token,
      language: row.language,
    });
    await prisma.stayRating.update({
      where: { id: row.id },
      // A test send is not a real one: it is recorded differently so it can
      // never count as "already sent" to the guest.
      data: { waSendStatus: testPhone && result.ok ? "TEST_SENT" : result.status },
    });

    return json({ ok: true, sent: result.ok, status: result.status, testMode: !!testPhone });
  } catch (err) {
    console.error("[checkout-notify] unexpected error:", err);
    return json({ ok: false, error: "Internal error" }, 500);
  }
}
