import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser, getBuildingScopeFilter } from "@/lib/adminAuth";
import { canSeeAllLaundry } from "@/lib/laundry/permissions";
import { serializeLaundryOrder } from "@/lib/laundry/serialize";
import LaundryBoard from "@/components/admin/laundry/LaundryBoard";
import type { TStaffRole } from "@/lib/tasks/constants";
import type { LaundryStatus, TaskPriority } from "@prisma/client";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ORDER_INCLUDE = {
  building: { select: { id: true, nameEn: true, nameAr: true, shortName: true } },
  requestedBy: { select: { id: true, name: true, email: true, role: true } },
  supervisor: { select: { id: true, name: true, email: true, role: true } },
  laundryUser: { select: { id: true, name: true, email: true, role: true } },
  items: { include: { itemType: { select: { nameEn: true, nameAr: true } } } },
} as const;

export default async function AdminLaundryPage({ params, searchParams }: PageProps) {
  const [{ locale }, sp, adminUser] = await Promise.all([
    params,
    searchParams,
    getCurrentAdminUser(),
  ]);
  if (!adminUser) return null; // middleware redirects to login

  const role = adminUser.role as TStaffRole;
  // Roles that have no business here go back to the dashboard.
  if (role === "HOUSEKEEPING" || role === "MAINTENANCE") {
    redirect(`/${locale}/admin`);
  }

  const status = sp.status as LaundryStatus | undefined;
  const priority = sp.priority as TaskPriority | undefined;
  const buildingId = sp.buildingId as string | undefined;
  const search = sp.search as string | undefined;

  // A YYYY-MM-DD string → a filter matching that whole calendar day.
  const dayRange = (d?: string) => {
    if (!d) return undefined;
    const start = new Date(`${d}T00:00:00`);
    if (Number.isNaN(start.getTime())) return undefined;
    return { gte: start, lte: new Date(`${d}T23:59:59.999`) };
  };
  const createdRange = dayRange(sp.createdOn as string | undefined);
  const receivedRange = dayRange(sp.receivedOn as string | undefined);
  const deliveredRange = dayRange(sp.deliveredOn as string | undefined);

  // Manager/Supervisor/Laundry see all; receptionists are scoped to their
  // assigned buildings. (getBuildingScopeFilter alone would hide everything
  // from the LAUNDRY role, which it doesn't know about.)
  const scope = canSeeAllLaundry(role)
    ? null
    : await getBuildingScopeFilter(adminUser);

  const [orders, buildings] = await Promise.all([
    prisma.laundryOrder.findMany({
      where: {
        ...(scope ?? {}),
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(buildingId ? { buildingId } : {}),
        ...(search ? { orderCode: { contains: search, mode: "insensitive" } } : {}),
        ...(createdRange ? { createdAt: createdRange } : {}),
        ...(receivedRange ? { atLaundryAt: receivedRange } : {}),
        ...(deliveredRange ? { deliveredAt: deliveredRange } : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true, shortName: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const serialized = orders.map(serializeLaundryOrder);

  return (
    <LaundryBoard
      orders={serialized}
      buildings={buildings}
      locale={locale}
      currentUserRole={role}
    />
  );
}
