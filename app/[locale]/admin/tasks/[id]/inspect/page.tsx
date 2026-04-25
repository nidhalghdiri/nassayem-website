import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/tasks/inspection";
import InspectionMode from "@/components/admin/tasks/InspectionMode";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function InspectTaskPage({ params }: PageProps) {
  const { locale, id: taskId } = await params;

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/login`);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      building: { select: { nameEn: true, nameAr: true } },
      inspectionChecklist: {
        include: {
          items: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
        },
      },
    },
  });

  if (!task) redirect(`/${locale}/admin/tasks`);
  if (task.type !== "INSPECTION") redirect(`/${locale}/admin/tasks`);

  // Lazily create checklist if it doesn't exist (for tasks created before this feature)
  let checklist = task.inspectionChecklist;
  if (!checklist) {
    checklist = await prisma.inspectionChecklist.create({
      data: { taskId },
      include: { items: true },
    });
    const newChecklist = checklist;
    await prisma.inspectionChecklistItem.createMany({
      data: DEFAULT_CHECKLIST_ITEMS.map((item, idx) => ({
        checklistId: newChecklist.id,
        category: item.category,
        label: item.labelEn,
        displayOrder: idx,
        status: "pending",
      })),
    });
    checklist = await prisma.inspectionChecklist.findUnique({
      where: { id: newChecklist.id },
      include: {
        items: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
      },
    });
  }

  if (!checklist) redirect(`/${locale}/admin/tasks`);

  // Serialize dates
  const serializedChecklist = {
    id: checklist.id,
    taskId: checklist.taskId,
    overallRating: checklist.overallRating,
    inspectorNotes: checklist.inspectorNotes,
    completedAt: checklist.completedAt?.toISOString() ?? null,
    items: checklist.items.map((item) => ({
      id: item.id,
      category: item.category,
      label: item.label,
      status: item.status,
      notes: item.notes,
      severity: item.severity,
      photoUrls: item.photoUrls,
      displayOrder: item.displayOrder,
    })),
  };

  const serializedTask = {
    id: task.id,
    title: task.title,
    unitNumber: task.unitNumber,
    building: task.building
      ? { nameEn: task.building.nameEn, nameAr: task.building.nameAr }
      : null,
  };

  return (
    <InspectionMode
      task={serializedTask}
      checklist={serializedChecklist}
      locale={locale}
    />
  );
}
