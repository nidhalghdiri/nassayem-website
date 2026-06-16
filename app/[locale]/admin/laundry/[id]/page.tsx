import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser, getBuildingScopeFilter } from "@/lib/adminAuth";
import { serializeLaundryOrder } from "@/lib/laundry/serialize";
import LaundryDetail from "@/components/admin/laundry/LaundryDetail";
import type { LaundryEventItem } from "@/components/admin/laundry/types";
import type { TStaffRole } from "@/lib/tasks/constants";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function LaundryOrderDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isEn = locale === "en";
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);

  const role = adminUser.role as TStaffRole;
  if (role === "HOUSEKEEPING" || role === "MAINTENANCE") {
    redirect(`/${locale}/admin`);
  }

  const order = await prisma.laundryOrder.findUnique({
    where: { id },
    include: {
      building: { select: { id: true, nameEn: true, nameAr: true } },
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      supervisor: { select: { id: true, name: true, email: true, role: true } },
      laundryUser: { select: { id: true, name: true, email: true, role: true } },
      items: {
        include: { itemType: { select: { nameEn: true, nameAr: true } } },
        orderBy: { createdAt: "asc" },
      },
      events: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) notFound();

  // Receptionists may only open orders for their assigned buildings.
  const scope = await getBuildingScopeFilter(adminUser);
  if (scope && !scope.buildingId.in.includes(order.buildingId)) {
    redirect(`/${locale}/admin/laundry`);
  }

  const serialized = serializeLaundryOrder(order);
  const events: LaundryEventItem[] = order.events.map((e) => ({
    id: e.id,
    action: e.action,
    details: e.details,
    createdAt: e.createdAt.toISOString(),
    user: { id: e.user.id, name: e.user.name, email: e.user.email, role: e.user.role },
  }));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href={`/${locale}/admin/laundry`} className="hover:text-gray-800 transition-colors">
          {isEn ? "Laundry" : "المغسلة"}
        </Link>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium font-mono">{order.orderCode}</span>
      </nav>

      <LaundryDetail
        order={serialized}
        events={events}
        locale={locale}
        currentUserId={adminUser.id}
        currentUserRole={role}
        isCreator={order.requestedById === adminUser.id}
      />
    </div>
  );
}
