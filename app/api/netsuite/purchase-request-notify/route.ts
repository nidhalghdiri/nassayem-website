/**
 * Inbound API for NetSuite — purchase request WhatsApp notifications.
 *
 * NetSuite owns these notifications. A user event fires on every purchase
 * request status change — including the supervisor decisions made on this
 * website, which are saved through the NetSuite API — and POSTs one event
 * here. NetSuite decides who is notified and with which template; this
 * endpoint only sends the messages. Nothing is sent from the supervisor
 * decision action, or everyone would be messaged twice.
 *
 * We:
 *   1. Verify the shared secret (x-netsuite-secret header).
 *   2. Validate the template name and its body-parameter count.
 *   3. Resolve recipients (NetSuite-supplied, plus website supervisors when
 *      the request is waiting for the supervisor), de-duplicated by phone.
 *   4. Send the template to each, in parallel, and await them all.
 *
 * Always answers 200 with { sent, failed } once authenticated and valid: a
 * failed WhatsApp send is logged to WhatsAppMessageLog, not turned into a 500.
 * NetSuite writes the response to its script log and never retries, so the
 * response body is the only diagnostic available.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { verifyNetsuiteInboundSecret } from "@/lib/netsuite";
import {
  PURCHASE_REQUEST_TEMPLATES,
  isPurchaseRequestTemplate,
  notifyPurchaseRequest,
  type PurchaseRequestRecipient,
} from "@/lib/whatsapp";

// CORS — matches the payment-link route. The endpoint is protected by the
// x-netsuite-secret header check, so allowing any origin to *attempt* a
// request is safe; only requests with the right secret get a useful response.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-netsuite-secret",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type NotifyBody = {
  template?: string;
  language?: string;
  requestId?: string;
  requestNumber?: string;
  includeSupervisors?: boolean;
  recipients?: { name?: string; phone?: string }[];
  /** Body variables from {{2}} onwards, already cleaned by NetSuite. */
  params?: string[];
  /**
   * Dynamic URL-button suffix. Accepted but NOT used: none of the three
   * templates was approved with a URL button, and Meta rejects parameters for
   * a component the template does not declare. Kept in the contract so the
   * NetSuite side needs no change if a button is added in Meta later.
   */
  buttonSuffix?: string;
};

/** Fallback for a supervisor with no name set, since {{1}} may never be empty. */
const SUPERVISOR_FALLBACK_NAME = "المشرف";

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
  const tag = `[ns-pur-req-wa ${reqId}]`;
  const log = (...args: unknown[]) => console.log(tag, ...args);

  try {
    log("▶ POST received", req.headers.get("origin") ?? "(no origin)");

    // 1. Auth ──────────────────────────────────────────────────────────────
    const providedSecret = req.headers.get("x-netsuite-secret");
    const expectedSecret = process.env.NETSUITE_INBOUND_SECRET;
    log("auth check:", {
      secretConfigured: !!expectedSecret,
      headerProvided: !!providedSecret,
      lengthsMatch:
        !!expectedSecret &&
        !!providedSecret &&
        expectedSecret.length === providedSecret.length,
    });
    if (!verifyNetsuiteInboundSecret(providedSecret)) {
      log("✖ 401 Unauthorized — secret missing/mismatch. Nothing sent.");
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }
    log("✓ auth ok");

    // 2. Parse + validate ──────────────────────────────────────────────────
    const rawText = await req.text();
    log("raw body:", rawText.slice(0, 2000));
    let body: NotifyBody;
    try {
      body = JSON.parse(rawText) as NotifyBody;
    } catch {
      log("✖ 400 invalid JSON body");
      return badRequest("Invalid JSON body");
    }

    const {
      template,
      language = "ar",
      requestId,
      requestNumber,
      includeSupervisors = false,
      recipients: rawRecipients,
      params: rawParams,
    } = body ?? {};

    if (!template || typeof template !== "string") {
      log("✖ 400 validation: template missing");
      return badRequest("template is required");
    }
    if (!isPurchaseRequestTemplate(template)) {
      log("✖ 400 validation: unknown template ->", template);
      return badRequest("Unknown template", {
        template,
        allowed: Object.keys(PURCHASE_REQUEST_TEMPLATES),
      });
    }

    if (!Array.isArray(rawParams)) {
      log("✖ 400 validation: params not an array ->", typeof rawParams);
      return badRequest("params must be an array");
    }
    // PURCHASE_REQUEST_TEMPLATES counts every body variable including {{1}},
    // the recipient's name, which is added per recipient — so the event
    // carries one fewer: {{2}} onwards.
    const expectedParams = PURCHASE_REQUEST_TEMPLATES[template] - 1;
    if (rawParams.length !== expectedParams) {
      log(
        `✖ 400 validation: ${template} needs ${expectedParams} params, got ${rawParams.length}`,
      );
      return badRequest(
        `${template} expects ${expectedParams} params ({{2}} onwards), got ${rawParams.length}`,
      );
    }
    // Meta rejects a non-text body parameter, so coerce defensively — NetSuite
    // already cleans these (no newlines, never empty, max 300 chars).
    const params = rawParams.map((p) => String(p ?? ""));

    if (rawRecipients !== undefined && !Array.isArray(rawRecipients)) {
      log("✖ 400 validation: recipients not an array ->", typeof rawRecipients);
      return badRequest("recipients must be an array when present");
    }
    log("✓ validation passed", { template, language, requestId, requestNumber });

    // 3. Resolve recipients ────────────────────────────────────────────────
    // NetSuite-side people first (accountants, GM, or the receptionist), so a
    // recipient NetSuite named explicitly wins the de-duplication over the
    // same number picked up from the supervisor list.
    const netsuiteRecipients: PurchaseRequestRecipient[] = (rawRecipients ?? [])
      .map((r) => ({
        name: String(r?.name ?? "").trim(),
        phone: String(r?.phone ?? "").trim(),
      }))
      .filter((r) => r.phone.replace(/\D/g, "") !== "");

    // includeSupervisors is set only while the request waits for the
    // supervisor — then EVERY website supervisor with a WhatsApp number is
    // notified, since any of them may act on it (/admin/purchase-requests is
    // not building-scoped for supervisors).
    let supervisorRecipients: PurchaseRequestRecipient[] = [];
    if (includeSupervisors === true) {
      const supervisors = await prisma.adminUser.findMany({
        where: { role: "SUPERVISOR", whatsappNumber: { not: null } },
        select: { name: true, whatsappNumber: true },
      });
      supervisorRecipients = supervisors
        .map((s) => ({
          name: s.name?.trim() || SUPERVISOR_FALLBACK_NAME,
          phone: (s.whatsappNumber ?? "").trim(),
        }))
        .filter((s) => s.phone.replace(/\D/g, "") !== "");
      log(
        `supervisors: ${supervisors.length} with a number, ${supervisorRecipients.length} usable`,
      );
    }

    const allRecipients = [...netsuiteRecipients, ...supervisorRecipients];
    if (allRecipients.length === 0) {
      // Not an error: NetSuite may legitimately send an empty list (e.g. no
      // accountant configured). Report it so the script log shows why.
      log("↩ no recipients to notify — nothing sent");
      return jsonOk({ ok: true, sent: 0, failed: 0, recipients: 0 });
    }

    // 4. Send ──────────────────────────────────────────────────────────────
    const { sent, failed, recipients } = await notifyPurchaseRequest({
      template,
      language,
      recipients: allRecipients,
      params,
    });

    log(
      `✓ done — ${recipients} unique of ${allRecipients.length} given; sent=${sent} failed=${failed}`,
    );
    return jsonOk({ ok: true, sent, failed, recipients });
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
