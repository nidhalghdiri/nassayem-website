"use server";

/**
 * Server Actions for the supervisor approval step on NetSuite purchase
 * requests. Everything that writes goes through here, because the NetSuite
 * `decide` action is a GET that changes data — it must only ever run from an
 * explicit button click, never a page render, link or prefetch.
 */

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import {
  requirePurchaseRequestUser,
  getPurchaseRequestLocationScope,
} from "@/lib/purchaseRequestAccess";
import {
  decidePurchaseRequest,
  PURCHASE_REQUEST_NOTE_MAX,
  type PurchaseRequestStatus,
} from "@/lib/netsuitePurchaseRequests";

export type DecisionActionResult =
  | { ok: true; status: PurchaseRequestStatus }
  | {
      ok: false;
      /**
       * STALE  — someone already acted; the UI says so and reloads.
       * Others map onto the API/client codes.
       */
      code:
        | "FORBIDDEN"
        | "STALE"
        | "NOT_FOUND"
        | "INVALID_PARAMS"
        | "NOT_CONFIGURED"
        | "UNREACHABLE"
        | "SERVER";
      error: string;
      /** With STALE: the status the request is in now. */
      currentStatus?: PurchaseRequestStatus;
    };

/**
 * Records a supervisor approve/reject in NetSuite, then logs it on the website.
 *
 * Order matters: NetSuite is the system of record, so it is written first. If
 * the local audit row then fails, the decision still stands — we log the
 * inconsistency rather than telling the supervisor their approval failed and
 * inviting a second attempt (which NetSuite would refuse with INVALID_STATUS
 * anyway).
 */
export async function decidePurchaseRequestAction(input: {
  id: string;
  /** Kept for the audit row, so the log reads without calling NetSuite. */
  requestNumber: string;
  decision: "approve" | "reject";
  note?: string;
}): Promise<DecisionActionResult> {
  let user;
  try {
    user = await requirePurchaseRequestUser();
  } catch {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You are not allowed to decide on purchase requests",
    };
  }

  const id = input.id?.trim();
  if (!id) {
    return { ok: false, code: "INVALID_PARAMS", error: "Missing request id" };
  }
  if (input.decision !== "approve" && input.decision !== "reject") {
    return { ok: false, code: "INVALID_PARAMS", error: "Invalid decision" };
  }

  const note = input.note?.trim() ?? "";
  if (input.decision === "reject" && !note) {
    return { ok: false, code: "INVALID_PARAMS", error: "A reason is required to reject" };
  }
  if (note.length > PURCHASE_REQUEST_NOTE_MAX) {
    return {
      ok: false,
      code: "INVALID_PARAMS",
      error: `The note must be at most ${PURCHASE_REQUEST_NOTE_MAX} characters`,
    };
  }

  // null today (both roles see all buildings) → locationIds is omitted and
  // NetSuite skips its location check.
  const locationScope = await getPurchaseRequestLocationScope(user);

  let result;
  try {
    result = await decidePurchaseRequest({
      id,
      decision: input.decision,
      note: note || undefined,
      actorName: user.name || user.email,
      actorRef: user.id,
      ...(locationScope ? { locationIds: locationScope } : {}),
    });
  } catch (err) {
    console.error("[purchase-requests] decide threw:", err);
    return { ok: false, code: "SERVER", error: "The decision could not be sent to NetSuite" };
  }

  if (!result.ok) {
    switch (result.code) {
      case "INVALID_STATUS":
        return {
          ok: false,
          code: "STALE",
          error: "Someone has already acted on this request",
          ...(result.status ? { currentStatus: result.status } : {}),
        };
      case "NOT_FOUND":
        return { ok: false, code: "NOT_FOUND", error: "This request no longer exists in NetSuite" };
      case "INVALID_PARAMS":
        return { ok: false, code: "INVALID_PARAMS", error: result.error };
      case "NOT_CONFIGURED":
        return { ok: false, code: "NOT_CONFIGURED", error: result.error };
      case "FORBIDDEN_LOCATION":
        return {
          ok: false,
          code: "FORBIDDEN",
          error: "This request's building is outside your scope",
        };
      case "UNAUTHORIZED":
      case "SERVER_ERROR":
      case "NETWORK":
      default:
        console.error("[purchase-requests] decide failed:", result.code, result.error);
        return { ok: false, code: "UNREACHABLE", error: "NetSuite could not be reached" };
    }
  }

  // NetSuite accepted the decision — the website audit row is best-effort.
  try {
    await prisma.purchaseRequestDecision.create({
      data: {
        netsuiteRequestId: id,
        requestNumber: input.requestNumber || "",
        decision: input.decision,
        note: note || null,
        adminUserId: user.id,
      },
    });
  } catch (err) {
    console.error(
      `[purchase-requests] NetSuite recorded ${input.decision} on ${id} but the local audit row failed:`,
      err,
    );
  }

  // Hook point: WhatsApp notifications (requester notified of the outcome) go
  // here, once the template is approved. Deliberately after the audit write and
  // wrapped on its own, so a notification failure can never fail a decision.

  revalidatePath("/[locale]/admin/purchase-requests", "page");
  return { ok: true, status: result.data.status };
}
