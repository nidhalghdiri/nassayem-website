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
  requirePurchaseRequestCreator,
  getPurchaseRequestLocationScope,
} from "@/lib/purchaseRequestAccess";
import {
  createPurchaseRequest,
  decidePurchaseRequest,
  PURCHASE_REQUEST_MAX_ITEMS,
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

  // Nobody approves their own request, even a supervisor who raised it here.
  const ownedByMe = await prisma.purchaseRequestOwner.findUnique({
    where: { netsuiteRequestId: id },
    select: { adminUserId: true },
  });
  if (ownedByMe?.adminUserId === user.id) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You cannot approve or reject a purchase request you raised yourself",
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

  // No notification is sent from here, deliberately. NetSuite owns purchase
  // request notifications: a user event fires on every status change — this
  // decision included, because it is saved through the NetSuite API — and
  // POSTs to /api/netsuite/purchase-request-notify, which sends the WhatsApp
  // template. Sending here as well would message everyone twice.

  revalidatePath("/[locale]/admin/purchase-requests", "page");
  return { ok: true, status: result.data.status };
}


export type CreateActionResult =
  | { ok: true; id: string; number: string }
  | {
      ok: false;
      code: "FORBIDDEN" | "INVALID_PARAMS" | "NOT_CONFIGURED" | "UNREACHABLE" | "SERVER";
      error: string;
    };

/**
 * Raises a purchase request from the admin panel (supervisor, maintenance).
 *
 * NetSuite is written first and is the system of record. The ownership row is
 * what lets a maintenance user see the request afterwards; if it fails to
 * save the request still exists, so the failure is logged loudly rather than
 * reported as a failed submit (which would invite a duplicate).
 */
export async function createPurchaseRequestAction(input: {
  locationId: string;
  reason: string;
  priority: "normal" | "urgent";
  tenantCharge: boolean;
  items: { description: string; quantity: number; price: number }[];
}): Promise<CreateActionResult> {
  let user;
  try {
    user = await requirePurchaseRequestCreator();
  } catch {
    return { ok: false, code: "FORBIDDEN", error: "You are not allowed to create purchase requests" };
  }

  const invalid = (error: string): CreateActionResult => ({ ok: false, code: "INVALID_PARAMS", error });

  const locationId = input.locationId?.trim();
  const reason = input.reason?.trim() ?? "";
  if (!locationId) return invalid("Choose a building");
  if (!reason) return invalid("A reason is required");
  if (reason.length > PURCHASE_REQUEST_NOTE_MAX) {
    return invalid(`The reason must be at most ${PURCHASE_REQUEST_NOTE_MAX} characters`);
  }
  if (input.priority !== "normal" && input.priority !== "urgent") return invalid("Invalid priority");

  // Only buildings mapped to NetSuite are valid, and a user linked to specific
  // buildings may only raise requests for those.
  const building = await prisma.building.findFirst({
    where: { netsuiteId: locationId },
    select: { id: true },
  });
  if (!building) return invalid("Unknown building");
  const assigned = await prisma.adminUserBuilding.findMany({
    where: { adminUserId: user.id },
    select: { buildingId: true },
  });
  if (assigned.length > 0 && !assigned.some((a) => a.buildingId === building.id)) {
    return { ok: false, code: "FORBIDDEN", error: "This building is outside your scope" };
  }

  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length === 0) return invalid("Add at least one item");
  if (items.length > PURCHASE_REQUEST_MAX_ITEMS) {
    return invalid(`At most ${PURCHASE_REQUEST_MAX_ITEMS} items per request`);
  }
  const cleanItems: { description: string; quantity: number; price: number }[] = [];
  for (const it of items) {
    const description = it.description?.trim() ?? "";
    const quantity = Number(it.quantity);
    const price = Number(it.price);
    if (!description) return invalid("Every item needs a description");
    if (description.length > 300) return invalid("An item description is too long");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return invalid("Invalid item quantity");
    if (!Number.isFinite(price) || price < 0 || price > 1000000) return invalid("Invalid item price");
    cleanItems.push({ description, quantity, price: Math.round(price * 1000) / 1000 });
  }

  let result;
  try {
    result = await createPurchaseRequest({
      locationId,
      reason,
      priority: input.priority,
      tenantCharge: !!input.tenantCharge,
      items: cleanItems,
      requesterName: user.name || user.email,
      requesterRef: user.id,
    });
  } catch (err) {
    console.error("[purchase-requests] create threw:", err);
    return { ok: false, code: "SERVER", error: "The request could not be sent to NetSuite" };
  }

  if (!result.ok) {
    switch (result.code) {
      case "INVALID_PARAMS":
        return invalid(result.error);
      case "NOT_CONFIGURED":
        return { ok: false, code: "NOT_CONFIGURED", error: result.error };
      case "FORBIDDEN_LOCATION":
        return { ok: false, code: "FORBIDDEN", error: "This building is outside your scope" };
      default:
        console.error("[purchase-requests] create failed:", result.code, result.error);
        return { ok: false, code: "UNREACHABLE", error: "NetSuite could not be reached" };
    }
  }

  try {
    await prisma.purchaseRequestOwner.create({
      data: { netsuiteRequestId: result.data.id, requestNumber: result.data.number, adminUserId: user.id },
    });
  } catch (err) {
    console.error(
      `[purchase-requests] NetSuite created ${result.data.number} (${result.data.id}) but the ownership row failed:`,
      err,
    );
  }

  revalidatePath("/[locale]/admin/purchase-requests", "page");
  return { ok: true, id: result.data.id, number: result.data.number };
}
