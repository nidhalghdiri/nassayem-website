// Server helper: turn a Prisma LaundryOrder (with items + itemType + people)
// into the serialized, discrepancy-annotated shape the UI consumes.
// Lives in lib/ (not a component) so both the list and detail pages share it.

import { getItemMissing, type ItemCounts } from "./workflow";
import type { SerializedLaundryOrder, Person } from "@/components/admin/laundry/types";

type PrismaItem = {
  id: string;
  itemTypeId: string;
  requestedQty: number;
  atLaundryQty: number | null;
  returnedQty: number | null;
  deliveredQty: number | null;
  itemType: { nameEn: string; nameAr: string };
};

type PrismaPerson = { id: string; name: string | null; email: string; role?: string } | null;

type PrismaOrder = {
  id: string;
  orderCode: string;
  status: string;
  priority: string;
  neededDate: Date;
  notes: string | null;
  createdAt: Date;
  atLaundryAt: Date | null;
  processingAt: Date | null;
  readyAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  building: { id: string; nameEn: string; nameAr: string } | null;
  requestedBy: PrismaPerson;
  supervisor: PrismaPerson;
  laundryUser: PrismaPerson;
  items: PrismaItem[];
};

const person = (p: PrismaPerson): Person | null =>
  p ? { id: p.id, name: p.name, email: p.email, role: p.role } : null;

export function serializeLaundryOrder(o: PrismaOrder): SerializedLaundryOrder {
  let totalRequested = 0;
  let totalMissing = 0;

  const items = o.items.map((i) => {
    const counts: ItemCounts = {
      requestedQty: i.requestedQty,
      atLaundryQty: i.atLaundryQty,
      returnedQty: i.returnedQty,
      deliveredQty: i.deliveredQty,
    };
    totalRequested += i.requestedQty;
    totalMissing += getItemMissing(counts);
    return {
      id: i.id,
      itemTypeId: i.itemTypeId,
      nameEn: i.itemType.nameEn,
      nameAr: i.itemType.nameAr,
      requestedQty: i.requestedQty,
      atLaundryQty: i.atLaundryQty,
      returnedQty: i.returnedQty,
      deliveredQty: i.deliveredQty,
    };
  });

  return {
    id: o.id,
    orderCode: o.orderCode,
    status: o.status,
    priority: o.priority,
    neededDate: o.neededDate.toISOString(),
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    atLaundryAt: o.atLaundryAt?.toISOString() ?? null,
    processingAt: o.processingAt?.toISOString() ?? null,
    readyAt: o.readyAt?.toISOString() ?? null,
    outForDeliveryAt: o.outForDeliveryAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    building: o.building,
    requestedBy: person(o.requestedBy),
    supervisor: person(o.supervisor),
    laundryUser: person(o.laundryUser),
    items,
    totalRequested,
    totalMissing,
    hasDiscrepancy: totalMissing > 0,
  };
}
