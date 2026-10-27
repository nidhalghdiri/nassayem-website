import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canSeeAllTasks } from "@/lib/tasks/permissions";
import { buildExcel, excelHeaders, type ExcelColumn } from "@/lib/excel";
import { STATUS_CONFIG, type TTaskStatus } from "@/lib/tasks/statuses";
import {
  TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG, STAFF_ROLE_CONFIG,
  type TTaskType, type TTaskPriority, type TStaffRole,
} from "@/lib/tasks/constants";
import { categoryLabel, roomLabel } from "@/lib/maintenance/categories";
import { taskSizeLabel } from "@/lib/maintenance/taskSize";
import {
  SUMMARY_PERIODS, baseWhere, periodRange, touchedSince,
  type SummaryPeriod, type SummaryRange,
} from "@/lib/reports/maintenanceSummary";

export const dynamic = "force-dynamic";

// Excel exports for the Manager/Supervisor maintenance tabs. Each sheet carries
// every column from the database — well beyond the on-screen tables — so the
// data can be analysed in Excel.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REPORTS = ["equipment", "other", "devices"] as const;
type Report = (typeof REPORTS)[number];

/** Hard cap so one click cannot pull an unbounded number of rows. */
const EXPORT_LIMIT = 5000;

const TASK_COLUMNS: ExcelColumn[] = [
  { header: "#", key: "requestNumber", width: 9 },
  { header: "النوع", key: "type", width: 13 },
  { header: "العنوان", key: "title", width: 34 },
  { header: "الوصف", key: "description", width: 48 },
  { header: "الحالة", key: "status", width: 16 },
  { header: "الأولوية", key: "priority", width: 11 },
  { header: "المبنى", key: "building", width: 28 },
  { header: "الوحدة", key: "unit", width: 12 },
  { header: "التصنيف", key: "category", width: 16 },
  { header: "الغرفة / المكان", key: "room", width: 16 },
  { header: "حجم المهمة", key: "taskSize", width: 12 },
  { header: "ضيف في الوحدة", key: "guestInUnit", width: 14 },
  { header: "الجهاز (كود)", key: "equipmentCode", width: 18 },
  { header: "المُكلَّف", key: "assignedTo", width: 24 },
  { header: "وظيفة المُكلَّف", key: "assignedToRole", width: 14 },
  { header: "أنشأها", key: "createdBy", width: 24 },
  { header: "وظيفة المُنشئ", key: "createdByRole", width: 14 },
  { header: "تاريخ الإنشاء", key: "createdAtDate", width: 13 },
  { header: "وقت الإنشاء", key: "createdAtTime", width: 11 },
  { header: "تاريخ التسليم", key: "dueDate", width: 13 },
  { header: "وقت التسليم", key: "dueTime", width: 11 },
  { header: "آخر تحديث", key: "updatedAtDate", width: 13 },
  { header: "وقت آخر تحديث", key: "updatedAtTime", width: 13 },
  { header: "متأخرة", key: "isOverdue", width: 9 },
  { header: "التأخير (ساعات)", key: "hoursLate", width: 15 },
  { header: "مدة الإنجاز (ساعات)", key: "hoursToComplete", width: 18 },
  { header: "تقييم النجوم", key: "stars", width: 12 },
  { header: "أعيد فتحها", key: "reopened", width: 11 },
  { header: "عدد الصور", key: "photoCount", width: 11 },
  { header: "عدد الملاحظات", key: "noteCount", width: 13 },
  { header: "عدد الأنشطة", key: "activityCount", width: 12 },
  { header: "مهمة أصلية #", key: "parentRequestNumber", width: 14 },
  { header: "معرّف المهمة", key: "id", width: 38 },
];

const DEVICE_COLUMNS: ExcelColumn[] = [
  { header: "كود الجهاز", key: "qrCode", width: 20 },
  { header: "النوع", key: "type", width: 18 },
  { header: "الماركة / الموديل", key: "brandModel", width: 24 },
  { header: "الحالة", key: "status", width: 16 },
  { header: "المبنى", key: "building", width: 28 },
  { header: "الوحدة", key: "unitNumber", width: 12 },
  { header: "عدد الزيارات", key: "visitCount", width: 12 },
  { header: "آخر زيارة", key: "lastVisitDate", width: 13 },
  { header: "آخر نتيجة", key: "lastVisitStatus", width: 14 },
  { header: "آخر فني", key: "lastTechnician", width: 24 },
  { header: "تاريخ الإضافة", key: "createdAtDate", width: 13 },
  { header: "آخر تحديث", key: "updatedAtDate", width: 13 },
  { header: "معرّف الجهاز", key: "id", width: 38 },
];

const TERMINAL = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
const EQUIPMENT_STATUS_AR: Record<string, string> = {
  GOOD: "جيدة",
  NEEDS_REPAIR: "يحتاج صيانة",
  NEEDS_REPLACEMENT: "يحتاج استبدال",
  OUT_OF_SERVICE: "خارج الخدمة",
};
const VISIT_STATUS_AR: Record<string, string> = {
  RESOLVED: "تم الإصلاح",
  NEEDS_PARTS: "بحاجة لقطع",
  UNRESOLVED: "لم يُحل",
};

export async function GET(req: NextRequest) {
  const user = await getCurrentAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSeeAllTasks(user.role as TStaffRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const report: Report = REPORTS.includes(sp.get("report") as Report) ? (sp.get("report") as Report) : "equipment";

  // A supervisor linked to specific buildings only exports those.
  const scopeBuildingIds = await getScopeBuildingIds(user);

  const stamp = format(new Date(), "yyyy-MM-dd");

  if (report === "devices") {
    const devices = await prisma.equipment.findMany({
      where: scopeBuildingIds ? { buildingId: { in: scopeBuildingIds } } : {},
      orderBy: { qrCode: "asc" },
      take: EXPORT_LIMIT,
      include: {
        type: { select: { nameAr: true, nameEn: true } },
        building: { select: { nameAr: true, nameEn: true, shortName: true } },
        visits: {
          orderBy: { visitDate: "desc" },
          take: 1,
          select: { visitDate: true, status: true, technician: { select: { name: true, email: true } } },
        },
        _count: { select: { visits: true } },
      },
    });

    const rows = devices.map((d) => {
      const last = d.visits[0];
      return {
        qrCode: d.qrCode,
        type: d.type.nameAr || d.type.nameEn || "",
        brandModel: d.brandModel ?? "",
        status: EQUIPMENT_STATUS_AR[d.status] ?? d.status,
        building: d.building.shortName || d.building.nameAr || d.building.nameEn,
        unitNumber: d.unitNumber ?? "",
        visitCount: d._count.visits,
        lastVisitDate: last ? format(last.visitDate, "yyyy-MM-dd") : "",
        lastVisitStatus: last ? VISIT_STATUS_AR[last.status] ?? last.status : "",
        lastTechnician: last ? last.technician.name || last.technician.email.split("@")[0] : "",
        createdAtDate: format(d.createdAt, "yyyy-MM-dd"),
        updatedAtDate: format(d.updatedAt, "yyyy-MM-dd"),
        id: d.id,
      };
    });

    const buffer = await buildExcel("قائمة الأجهزة", DEVICE_COLUMNS, rows);
    return new NextResponse(buffer, { headers: excelHeaders(`equipment-list-${stamp}.xlsx`) });
  }

  // ── Task reports (equipment / other maintenance) ───────────────────────────
  const range = safeRange(sp.get("period"), sp.get("from"), sp.get("to"));
  const now = Date.now();
  const { since, until } = periodRange(range, now);
  const base = await baseWhere(report === "equipment" ? "ALL_EQUIPMENT" : "ALL_OTHER", scopeBuildingIds);
  const where: Prisma.TaskWhereInput = { AND: [base, touchedSince(since, until)] };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    include: {
      building: { select: { nameAr: true, nameEn: true, shortName: true } },
      unit: { select: { name: true } },
      assignedTo: { select: { name: true, email: true, role: true } },
      createdBy: { select: { name: true, email: true, role: true } },
      parentTask: { select: { requestNumber: true } },
      notes: { select: { text: true } },
      activities: { select: { action: true } },
      _count: { select: { photos: true, notes: true, activities: true } },
    },
  });

  const roleAr = (role: string) => STAFF_ROLE_CONFIG[role as TStaffRole]?.labelAr ?? role;
  const hours = (a: Date, b: Date) => Math.round(((a.getTime() - b.getTime()) / 36e5) * 10) / 10;
  const nowDate = new Date(now);

  const rows = tasks.map((t) => {
    const isTerminal = TERMINAL.includes(t.status);
    const overdue = !isTerminal && t.dueDate < nowDate;
    const starNotes = t.notes.filter((n) => n.text.startsWith("★"));
    const lastStar = starNotes.length > 0 ? starNotes[starNotes.length - 1].text.match(/★(\d+)/) : null;
    const reopened = t.activities.some((a) => a.action.startsWith("rejected"));

    // Equipment requests carry the device code in the title ("نوع — CODE").
    const codeMatch = t.title.match(/([A-Z]{2,}-[A-Za-z0-9-]+)/);

    return {
      requestNumber: t.requestNumber,
      type: TASK_TYPE_CONFIG[t.type as TTaskType]?.labelAr ?? t.type,
      title: t.title,
      description: t.description ?? "",
      status: STATUS_CONFIG[t.status as TTaskStatus]?.labelAr ?? t.status,
      priority: TASK_PRIORITY_CONFIG[t.priority as TTaskPriority]?.labelAr ?? t.priority,
      building: t.building.shortName || t.building.nameAr || t.building.nameEn,
      unit: t.unit?.name || t.unitNumber || "",
      category: categoryLabel(t.category, false) ?? t.category ?? "",
      room: roomLabel(t.room, false) ?? "",
      taskSize: taskSizeLabel(t.taskSize, false) ?? "",
      guestInUnit: t.guestInUnit === null ? "" : t.guestInUnit ? "نعم" : "لا",
      equipmentCode: codeMatch ? codeMatch[1] : "",
      assignedTo: t.assignedTo.name || t.assignedTo.email.split("@")[0],
      assignedToRole: roleAr(t.assignedTo.role),
      createdBy: t.createdBy.name || t.createdBy.email.split("@")[0],
      createdByRole: roleAr(t.createdBy.role),
      createdAtDate: format(t.createdAt, "yyyy-MM-dd"),
      createdAtTime: format(t.createdAt, "HH:mm"),
      dueDate: format(t.dueDate, "yyyy-MM-dd"),
      dueTime: format(t.dueDate, "HH:mm"),
      updatedAtDate: format(t.updatedAt, "yyyy-MM-dd"),
      updatedAtTime: format(t.updatedAt, "HH:mm"),
      isOverdue: overdue ? "نعم" : "لا",
      hoursLate: overdue ? hours(nowDate, t.dueDate) : "",
      hoursToComplete: isTerminal ? hours(t.updatedAt, t.createdAt) : "",
      stars: lastStar ? Number(lastStar[1]) : "",
      reopened: reopened ? "نعم" : "لا",
      photoCount: t._count.photos,
      noteCount: t._count.notes,
      activityCount: t._count.activities,
      parentRequestNumber: t.parentTask?.requestNumber ?? "",
      id: t.id,
    };
  });

  const sheet = report === "equipment" ? "صيانة الأجهزة" : "الصيانة الأخرى";
  const buffer = await buildExcel(sheet, TASK_COLUMNS, rows);
  return new NextResponse(buffer, {
    headers: excelHeaders(`maintenance-${report}-${stamp}.xlsx`),
  });
}

/** The period comes from the browser: unknown values fall back to 7 days. */
function safeRange(period: string | null, from: string | null, to: string | null): SummaryRange {
  const p = (SUMMARY_PERIODS as readonly string[]).includes(period ?? "") ? (period as SummaryPeriod) : "7D";
  if (p !== "CUSTOM") return { period: p };
  const f = from && DATE_RE.test(from) ? from : undefined;
  const t = to && DATE_RE.test(to) ? to : undefined;
  if (!f || (t && t < f)) return { period: "7D" };
  return { period: p, from: f, to: t };
}

/** A supervisor linked to specific buildings only sees those (null = all). */
async function getScopeBuildingIds(user: { id: string; role: string }): Promise<string[] | null> {
  if (user.role !== "SUPERVISOR") return null;
  const assigned = await prisma.adminUserBuilding.findMany({
    where: { adminUserId: user.id },
    select: { buildingId: true },
  });
  return assigned.length > 0 ? assigned.map((b) => b.buildingId) : null;
}
