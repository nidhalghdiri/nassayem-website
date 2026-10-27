import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canSeeAllTasks } from "@/lib/tasks/permissions";
import { buildExcel, excelHeaders, type ExcelColumn } from "@/lib/excel";
import { STATUS_CONFIG, type TTaskStatus } from "@/lib/tasks/statuses";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG, STAFF_ROLE_CONFIG, type TTaskType, type TTaskPriority, type TStaffRole } from "@/lib/tasks/constants";
import { categoryLabel, roomLabel } from "@/lib/maintenance/categories";
import { taskSizeLabel } from "@/lib/maintenance/taskSize";

export const dynamic = "force-dynamic";

// Excel export for the Manager dashboard's "Task progress" cards. Unlike the
// on-screen modal (a handful of columns), this writes every Task column plus
// its related names and counts, so the sheet can be analysed in Excel.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CARDS = ["total", "inProgress", "overdue"] as const;
type Card = (typeof CARDS)[number];

const IN_PROGRESS_STATUSES = ["CLEANING_STARTED", "INSPECTING", "ISSUES_FOUND", "WORK_STARTED", "IN_PROGRESS"] as const;
const TERMINAL_STATUSES = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"] as const;

/** Hard cap so one click cannot pull an unbounded number of rows. */
const EXPORT_LIMIT = 5000;

const COLUMNS: ExcelColumn[] = [
  { header: "#", key: "requestNumber", width: 9 },
  { header: "النوع", key: "type", width: 14 },
  { header: "العنوان", key: "title", width: 34 },
  { header: "الوصف", key: "description", width: 48 },
  { header: "الحالة", key: "status", width: 16 },
  { header: "الأولوية", key: "priority", width: 12 },
  { header: "المبنى", key: "building", width: 28 },
  { header: "الوحدة", key: "unit", width: 12 },
  { header: "نوع التنظيف", key: "cleaningType", width: 14 },
  { header: "التصنيف", key: "category", width: 16 },
  { header: "الغرفة / المكان", key: "room", width: 16 },
  { header: "حجم المهمة", key: "taskSize", width: 12 },
  { header: "ضيف في الوحدة", key: "guestInUnit", width: 14 },
  { header: "المُكلَّف", key: "assignedTo", width: 24 },
  { header: "وظيفة المُكلَّف", key: "assignedToRole", width: 14 },
  { header: "بريد المُكلَّف", key: "assignedToEmail", width: 26 },
  { header: "أنشأها", key: "createdBy", width: 24 },
  { header: "وظيفة المُنشئ", key: "createdByRole", width: 14 },
  { header: "تاريخ الإنشاء", key: "createdAtDate", width: 13 },
  { header: "وقت الإنشاء", key: "createdAtTime", width: 11 },
  { header: "تاريخ التسليم", key: "dueDate", width: 13 },
  { header: "وقت التسليم", key: "dueTime", width: 11 },
  { header: "آخر تحديث", key: "updatedAtDate", width: 13 },
  { header: "وقت آخر تحديث", key: "updatedAtTime", width: 13 },
  { header: "متأخرة", key: "isOverdue", width: 10 },
  { header: "التأخير (ساعات)", key: "hoursLate", width: 15 },
  { header: "مدة الإنجاز (ساعات)", key: "hoursToComplete", width: 18 },
  { header: "تقييم النجوم", key: "stars", width: 12 },
  { header: "عدد الصور", key: "photoCount", width: 11 },
  { header: "عدد الملاحظات", key: "noteCount", width: 13 },
  { header: "عدد الأنشطة", key: "activityCount", width: 12 },
  { header: "مهمة أصلية #", key: "parentRequestNumber", width: 14 },
  { header: "عدد المهام الفرعية", key: "subTaskCount", width: 16 },
  { header: "معرّف المهمة", key: "id", width: 38 },
];

export async function GET(req: NextRequest) {
  const user = await getCurrentAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Same guard as the report's own action: only roles that can see all tasks.
  if (!canSeeAllTasks(user.role as TStaffRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const card: Card = CARDS.includes(sp.get("card") as Card) ? (sp.get("card") as Card) : "total";

  // Mirrors the filters of the on-screen report.
  const assigneeIds = sp.getAll("assignee").filter((id) => id.length > 0 && id.length <= 64).slice(0, 200);
  const fromRaw = sp.get("from");
  const toRaw = sp.get("to");
  const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : undefined;
  let to = toRaw && DATE_RE.test(toRaw) ? toRaw : undefined;
  if (from && to && to < from) to = undefined;

  const now = new Date();
  const assigneeWhere: Prisma.TaskWhereInput = assigneeIds.length > 0 ? { assignedToId: { in: assigneeIds } } : {};

  let where: Prisma.TaskWhereInput;
  if (card === "total") {
    const and: Prisma.TaskWhereInput[] = [assigneeWhere];
    if (from) and.push({ createdAt: { gte: new Date(`${from}T00:00:00+04:00`) } });
    if (to) and.push({ createdAt: { lte: new Date(`${to}T23:59:59.999+04:00`) } });
    where = { AND: and };
  } else if (card === "inProgress") {
    // Live, ignores the dates — same as the card.
    where = { AND: [assigneeWhere, { status: { in: [...IN_PROGRESS_STATUSES] } }] };
  } else {
    where = { AND: [assigneeWhere, { status: { notIn: [...TERMINAL_STATUSES] }, dueDate: { lt: now } }] };
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: card === "total" ? { createdAt: "desc" } : { dueDate: "asc" },
    take: EXPORT_LIMIT,
    include: {
      building: { select: { nameAr: true, nameEn: true, shortName: true } },
      unit: { select: { name: true } },
      assignedTo: { select: { name: true, email: true, role: true } },
      createdBy: { select: { name: true, email: true, role: true } },
      parentTask: { select: { requestNumber: true } },
      notes: { select: { text: true } },
      _count: { select: { photos: true, notes: true, activities: true, subTasks: true } },
    },
  });

  const roleAr = (role: string) => STAFF_ROLE_CONFIG[role as TStaffRole]?.labelAr ?? role;
  const hours = (a: Date, b: Date) => Math.round(((a.getTime() - b.getTime()) / 36e5) * 10) / 10;

  const rows = tasks.map((t) => {
    const isTerminal = (TERMINAL_STATUSES as readonly string[]).includes(t.status);
    const overdue = !isTerminal && t.dueDate < now;

    // Supervisor star rating is stored as a note like "★4 - ...": take the last one.
    const starNotes = t.notes.filter((n) => n.text.startsWith("★"));
    const lastStar = starNotes.length > 0 ? starNotes[starNotes.length - 1].text.match(/★(\d+)/) : null;

    return {
      requestNumber: t.requestNumber,
      type: TASK_TYPE_CONFIG[t.type as TTaskType]?.labelAr ?? t.type,
      title: t.title,
      description: t.description ?? "",
      status: STATUS_CONFIG[t.status as TTaskStatus]?.labelAr ?? t.status,
      priority: TASK_PRIORITY_CONFIG[t.priority as TTaskPriority]?.labelAr ?? t.priority,
      building: t.building.shortName || t.building.nameAr || t.building.nameEn,
      unit: t.unit?.name || t.unitNumber || "",
      cleaningType: t.cleaningType ?? "",
      category: categoryLabel(t.category, false) ?? t.category ?? "",
      room: roomLabel(t.room, false) ?? "",
      taskSize: taskSizeLabel(t.taskSize, false) ?? "",
      guestInUnit: t.guestInUnit === null ? "" : t.guestInUnit ? "نعم" : "لا",
      assignedTo: t.assignedTo.name || t.assignedTo.email.split("@")[0],
      assignedToRole: roleAr(t.assignedTo.role),
      assignedToEmail: t.assignedTo.email,
      createdBy: t.createdBy.name || t.createdBy.email.split("@")[0],
      createdByRole: roleAr(t.createdBy.role),
      createdAtDate: format(t.createdAt, "yyyy-MM-dd"),
      createdAtTime: format(t.createdAt, "HH:mm"),
      dueDate: format(t.dueDate, "yyyy-MM-dd"),
      dueTime: format(t.dueDate, "HH:mm"),
      updatedAtDate: format(t.updatedAt, "yyyy-MM-dd"),
      updatedAtTime: format(t.updatedAt, "HH:mm"),
      isOverdue: overdue ? "نعم" : "لا",
      hoursLate: overdue ? hours(now, t.dueDate) : "",
      hoursToComplete: isTerminal ? hours(t.updatedAt, t.createdAt) : "",
      stars: lastStar ? Number(lastStar[1]) : "",
      photoCount: t._count.photos,
      noteCount: t._count.notes,
      activityCount: t._count.activities,
      parentRequestNumber: t.parentTask?.requestNumber ?? "",
      subTaskCount: t._count.subTasks,
      id: t.id,
    };
  });

  const sheetAr: Record<Card, string> = {
    total: "إجمالي المهام",
    inProgress: "قيد الإنجاز",
    overdue: "المهام المتأخرة",
  };
  const stamp = format(new Date(), "yyyy-MM-dd");
  const buffer = await buildExcel(sheetAr[card], COLUMNS, rows);

  return new NextResponse(buffer, {
    headers: excelHeaders(`tasks-${card}-${stamp}.xlsx`),
  });
}
