"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import {
  canCreateLaundryOrder,
  canAdvanceLaundry,
  canCancelLaundry,
} from "@/lib/laundry/permissions";
import {
  getForwardTransition,
  getTransition,
  getItemLegs,
  type ItemCounts,
} from "@/lib/laundry/workflow";
import { LAUNDRY_STATUS_CONFIG, COUNT_STAGES, type TLaundryStatus } from "@/lib/laundry/constants";
import { notifyLaundryUpdate } from "@/lib/whatsapp";
import type { TStaffRole } from "@/lib/tasks/constants";
import type { TaskPriority } from "@prisma/client";

// ── Helpers ──────────────────────────────────────────────────────────────────

// Short human-readable order code like LDY-K4X7Q2.
async function generateOrderCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I to avoid confusion
  let code: string;
  let attempts = 0;
  do {
    code =
      "LDY-" +
      Array.from({ length: 6 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length)),
      ).join("");
    attempts++;
    if (attempts > 20) break; // safety valve
    const exists = await prisma.laundryOrder.findUnique({ where: { orderCode: code } });
    if (!exists) break;
  } while (true);
  return code;
}

// Building ids a receptionist is assigned to.
async function receptionistBuildingIds(adminUserId: string): Promise<string[]> {
  const rows = await prisma.adminUserBuilding.findMany({
    where: { adminUserId },
    select: { buildingId: true },
  });
  return rows.map((r) => r.buildingId);
}

function revalidateLaundry(locale: string, orderId?: string) {
  revalidatePath(`/${locale}/admin/laundry`);
  if (orderId) revalidatePath(`/${locale}/admin/laundry/${orderId}`);
}

// Recipients (with a WhatsApp number) for a given set of roles.
async function recipientsForRoles(roles: TStaffRole[]) {
  return prisma.adminUser.findMany({
    where: { role: { in: roles }, whatsappNumber: { not: null } },
    select: { name: true, whatsappNumber: true, preferredLanguage: true },
  });
}

// ── Create a laundry request (RECEPTIONIST / MANAGER) ──────────────────────────
export async function createLaundryOrder(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return { error: "Unauthorized." };
  const role = adminUser.role as TStaffRole;
  if (!canCreateLaundryOrder(role)) {
    return { error: "You do not have permission to request laundry." };
  }

  const locale = (formData.get("locale") as string) || "en";
  const buildingId = formData.get("buildingId") as string;
  const neededDate = formData.get("neededDate") as string;
  const priority = (formData.get("priority") as TaskPriority) || "MEDIUM";
  const notes = (formData.get("notes") as string)?.trim() || null;

  // Item lines arrive as parallel arrays.
  const itemTypeIds = formData.getAll("itemTypeId") as string[];
  const quantities = formData.getAll("requestedQty") as string[];

  if (!buildingId || !neededDate) {
    return { error: "Please choose a building and a needed-by date." };
  }

  // Build the validated item lines (skip blank rows; require qty ≥ 1).
  const lines: { itemTypeId: string; requestedQty: number }[] = [];
  for (let i = 0; i < itemTypeIds.length; i++) {
    const itemTypeId = itemTypeIds[i];
    const qty = parseInt(quantities[i] ?? "", 10);
    if (!itemTypeId) continue;
    if (!Number.isInteger(qty) || qty < 1) {
      return { error: "Each laundry item needs a quantity of at least 1." };
    }
    lines.push({ itemTypeId, requestedQty: qty });
  }
  if (lines.length === 0) {
    return { error: "Add at least one laundry item." };
  }

  // Receptionists may only request for their assigned buildings.
  if (role === "RECEPTIONIST") {
    const allowed = await receptionistBuildingIds(adminUser.id);
    if (!allowed.includes(buildingId)) {
      return { error: "You can only request laundry for your assigned buildings." };
    }
  }

  const orderCode = await generateOrderCode();
  const order = await prisma.laundryOrder.create({
    data: {
      orderCode,
      buildingId,
      requestedById: adminUser.id,
      priority,
      status: "REQUESTED",
      neededDate: new Date(neededDate),
      notes,
      items: { create: lines },
    },
  });

  const summary = await itemSummary(order.id);
  await prisma.laundryEvent.create({
    data: {
      orderId: order.id,
      userId: adminUser.id,
      action: "order_created",
      details: `Laundry requested — ${summary}.`,
    },
  });

  // Notify supervisors that a pickup is waiting (non-blocking).
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { nameEn: true },
  });
  const supervisors = await recipientsForRoles(["SUPERVISOR"]);
  notifyLaundryUpdate({
    recipients: supervisors,
    orderCode,
    buildingName: building?.nameEn ?? "",
    orderId: order.id,
    statusLabelEn: "New pickup requested",
    statusLabelAr: "طلب استلام جديد",
    neededDate: new Date(neededDate),
  }).catch(console.error);

  revalidateLaundry(locale);
  redirect(`/${locale}/admin/laundry`);
}

// Builds a "Carpet ×3, Pillow ×2" style summary of an order's requested items.
async function itemSummary(orderId: string): Promise<string> {
  const items = await prisma.laundryOrderItem.findMany({
    where: { orderId },
    include: { itemType: { select: { nameEn: true } } },
  });
  return items.map((i) => `${i.itemType.nameEn} ×${i.requestedQty}`).join(", ");
}

// ── Advance an order to the next status (role-gated, captures counts) ──────────
export async function advanceLaundryStatus(input: {
  orderId: string;
  toStatus: TLaundryStatus;
  /** itemId → counted quantity. Required when this step captures a count. */
  counts?: Record<string, number>;
  locale: string;
}): Promise<{ error: string | null }> {
  const { orderId, toStatus, counts, locale = "en" } = input;

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return { error: "Unauthorized." };
  const role = adminUser.role as TStaffRole;

  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      building: { select: { nameEn: true } },
      requestedBy: { select: { name: true, whatsappNumber: true, preferredLanguage: true } },
    },
  });
  if (!order) return { error: "Order not found." };

  const from = order.status as TLaundryStatus;
  const forward = getForwardTransition(from);
  if (!forward || forward.to !== toStatus) {
    return { error: "Invalid status change." };
  }
  if (!canAdvanceLaundry(role, from)) {
    return { error: "Your role cannot perform this step." };
  }

  // Receptionists can only act on orders for their assigned buildings.
  if (role === "RECEPTIONIST") {
    const allowed = await receptionistBuildingIds(adminUser.id);
    if (!allowed.includes(order.buildingId)) {
      return { error: "This order is not for one of your buildings." };
    }
  }

  const transition = getTransition(from, toStatus)!;

  // Validate & apply per-item counts when this step captures one.
  const countWarnings: string[] = [];
  if (transition.countField) {
    const field = transition.countField;
    const updates: { id: string; value: number }[] = [];
    for (const item of order.items) {
      const raw = counts?.[item.id];
      if (raw === undefined || raw === null || !Number.isInteger(raw) || raw < 0) {
        return { error: "Enter a count for every item before continuing." };
      }
      updates.push({ id: item.id, value: raw });
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.laundryOrderItem.update({
          where: { id: u.id },
          data: { [field]: u.value },
        }),
      ),
    );

    // Recompute discrepancies on this step using the freshly written counts.
    const itemTypes = await prisma.laundryOrderItem.findMany({
      where: { orderId },
      include: { itemType: { select: { nameEn: true } } },
    });
    for (const item of itemTypes) {
      const legs = getItemLegs(item as unknown as ItemCounts);
      const thisLeg = legs.find((l) => l.field === field);
      if (thisLeg && thisLeg.delta > 0) {
        countWarnings.push(
          `${thisLeg.delta}× ${item.itemType.nameEn} missing vs ${legLabel(thisLeg.prevField)}`,
        );
      }
    }
  }

  // Stamp the status, timestamp, and (optionally) the custodian.
  const data: Record<string, unknown> = {
    status: toStatus,
    [transition.timestampField]: new Date(),
  };
  if (transition.personField) data[transition.personField] = adminUser.id;
  await prisma.laundryOrder.update({ where: { id: orderId }, data });

  const statusLabel = LAUNDRY_STATUS_CONFIG[toStatus];
  let details = `Status changed to ${statusLabel.labelEn}.`;
  if (countWarnings.length > 0) {
    details += ` ⚠ ${countWarnings.join("; ")}.`;
  }
  await prisma.laundryEvent.create({
    data: { orderId, userId: adminUser.id, action: "status_changed", details },
  });

  // Notify the right people for this stage (non-blocking).
  await notifyForStatus(toStatus, {
    orderCode: order.orderCode,
    buildingName: order.building?.nameEn ?? "",
    orderId,
    neededDate: order.neededDate,
    requester: order.requestedBy,
  });

  revalidateLaundry(locale, orderId);
  return { error: null };
}

function legLabel(field: string): string {
  return COUNT_STAGES.find((s) => s.field === field)?.labelEn ?? field;
}

// Sends the stage-appropriate WhatsApp notification.
async function notifyForStatus(
  status: TLaundryStatus,
  ctx: {
    orderCode: string;
    buildingName: string;
    orderId: string;
    neededDate: Date;
    requester: { name: string | null; whatsappNumber: string | null; preferredLanguage: string } | null;
  },
) {
  const base = {
    orderCode: ctx.orderCode,
    buildingName: ctx.buildingName,
    orderId: ctx.orderId,
    neededDate: ctx.neededDate,
  };

  if (status === "PICKED_UP") {
    notifyLaundryUpdate({
      ...base,
      recipients: await recipientsForRoles(["LAUNDRY"]),
      statusLabelEn: "Laundry incoming",
      statusLabelAr: "غسيل في الطريق",
    }).catch(console.error);
  } else if (status === "READY") {
    notifyLaundryUpdate({
      ...base,
      recipients: await recipientsForRoles(["SUPERVISOR"]),
      statusLabelEn: "Ready for collection",
      statusLabelAr: "جاهز للاستلام",
    }).catch(console.error);
  } else if (status === "OUT_FOR_DELIVERY" || status === "DELIVERED") {
    // Tell the receptionist who requested it.
    if (ctx.requester?.whatsappNumber) {
      notifyLaundryUpdate({
        ...base,
        recipients: [ctx.requester],
        statusLabelEn: status === "DELIVERED" ? "Delivered" : "Out for delivery",
        statusLabelAr: status === "DELIVERED" ? "تم التسليم" : "قيد التوصيل",
      }).catch(console.error);
    }
  }
}

// ── Cancel an order ────────────────────────────────────────────────────────────
export async function cancelLaundryOrder(input: {
  orderId: string;
  reason?: string;
  locale: string;
}): Promise<{ error: string | null }> {
  const { orderId, reason, locale = "en" } = input;
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return { error: "Unauthorized." };
  const role = adminUser.role as TStaffRole;

  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { status: true, requestedById: true },
  });
  if (!order) return { error: "Order not found." };

  const isCreator = order.requestedById === adminUser.id;
  if (!canCancelLaundry(role, order.status as TLaundryStatus, isCreator)) {
    return { error: "You cannot cancel this order at its current stage." };
  }

  await prisma.laundryOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
  await prisma.laundryEvent.create({
    data: {
      orderId,
      userId: adminUser.id,
      action: "cancelled",
      details: reason?.trim()
        ? `Order cancelled — ${reason.trim()}.`
        : "Order cancelled.",
    },
  });

  revalidateLaundry(locale, orderId);
  return { error: null };
}

// ── Add a note to an order ─────────────────────────────────────────────────────
export async function addLaundryNote(input: {
  orderId: string;
  text: string;
  locale: string;
}): Promise<{ error: string | null }> {
  const { orderId, text, locale = "en" } = input;
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return { error: "Unauthorized." };

  const trimmed = text?.trim();
  if (!trimmed) return { error: "Note cannot be empty." };

  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!order) return { error: "Order not found." };

  await prisma.laundryEvent.create({
    data: { orderId, userId: adminUser.id, action: "note_added", details: trimmed },
  });

  revalidateLaundry(locale, orderId);
  return { error: null };
}
