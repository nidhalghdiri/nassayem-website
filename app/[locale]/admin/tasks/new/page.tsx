import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canOpenCreateTask, isSelfOnlyCreator, ASSIGNABLE_ROLES } from "@/lib/tasks/permissions";
import prisma from "@/lib/prisma";
import CreateTaskForm from "@/components/admin/tasks/CreateTaskForm";
import type { TStaffRole } from "@/lib/tasks/constants";
import type { StaffRole } from "@prisma/client";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function NewTaskPage({ params, searchParams }: PageProps) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const parentTaskId = sp.parentTaskId ?? null;
  const adminUser = await getCurrentAdminUser();

  if (!adminUser) redirect(`/${locale}/admin/login`);
  const role = adminUser.role as TStaffRole;
  if (!canOpenCreateTask(role)) redirect(`/${locale}/admin/tasks`);

  const selfOnly = isSelfOnlyCreator(role);
  const allowedRoles = ASSIGNABLE_ROLES[role] as StaffRole[];
  const isEn = locale === "en";

  const [buildings, assignableStaff, parentTask] = await Promise.all([
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    // Self-only creators can only assign to themselves.
    selfOnly
      ? prisma.adminUser.findMany({
          where: { id: adminUser.id },
          select: { id: true, name: true, email: true, role: true },
        })
      : prisma.adminUser.findMany({
          where: { role: { in: allowedRoles } },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" },
        }),
    parentTaskId
      ? prisma.task.findUnique({
          where: { id: parentTaskId },
          select: { id: true, title: true, type: true },
        })
      : null,
  ]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href={`/${locale}/admin/tasks`} className="hover:text-gray-800 transition-colors">
          {isEn ? "Tasks" : "المهام"}
        </Link>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium">{isEn ? "New Task" : "مهمة جديدة"}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEn ? "Create Task" : "إنشاء مهمة جديدة"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEn
            ? "Fill in the details below. Fields marked with * are required."
            : "أدخل التفاصيل أدناه. الحقول المميزة بـ * مطلوبة."}
        </p>
      </div>

      <CreateTaskForm
        buildings={buildings}
        assignableStaff={assignableStaff}
        locale={locale}
        parentTask={parentTask ?? null}
        selfOnly={selfOnly}
      />
    </div>
  );
}
