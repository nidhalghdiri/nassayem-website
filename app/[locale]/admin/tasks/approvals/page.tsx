import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canApproveRequests } from "@/lib/tasks/permissions";
import prisma from "@/lib/prisma";
import ApprovalsQueue from "@/components/admin/tasks/ApprovalsQueue";
import type { TStaffRole } from "@/lib/tasks/constants";

type PageProps = { params: Promise<{ locale: string }> };

export default async function ApprovalsPage({ params }: PageProps) {
  const { locale } = await params;
  const adminUser = await getCurrentAdminUser();

  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canApproveRequests(adminUser.role as TStaffRole)) {
    redirect(`/${locale}/admin/tasks`);
  }

  const isEn = locale === "en";

  const pendingTasks = await prisma.task.findMany({
    where: { status: "PENDING_APPROVAL" },
    select: {
      id: true,
      type: true,
      title: true,
      priority: true,
      dueDate: true,
      createdAt: true,
      building: { select: { nameEn: true, nameAr: true } },
      unit: { select: { unitCode: true, titleEn: true, titleAr: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" }, // oldest first — FIFO
  });

  const serialized = pendingTasks.map((t) => ({
    ...t,
    dueDate: t.dueDate.toISOString(),
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href={`/${locale}/admin/tasks`} className="hover:text-gray-800 transition-colors">
          {isEn ? "Tasks" : "المهام"}
        </Link>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium">
          {isEn ? "Approvals" : "الموافقات"}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {isEn ? "Pending Approvals" : "طلبات قيد الموافقة"}
            {pendingTasks.length > 0 && (
              <span className="inline-flex items-center justify-center w-7 h-7 text-xs font-bold bg-yellow-400 text-yellow-900 rounded-full">
                {pendingTasks.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEn
              ? "Review and action maintenance requests submitted for approval."
              : "راجع طلبات الصيانة المُقدَّمة وأجرِ عليها إجراءً مناسباً."}
          </p>
        </div>
      </div>

      <ApprovalsQueue initialTasks={serialized} locale={locale} />
    </div>
  );
}
