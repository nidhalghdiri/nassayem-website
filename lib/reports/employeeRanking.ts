import prisma from "@/lib/prisma";
import { effectiveExpectedHours } from "@/lib/maintenance/taskSize";
import type { TaskStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Employee of the week — six criteria, 100 points.
//
// One rule everywhere:  score = ratio × criterion weight
// so nobody can exceed a criterion's weight (the highest ratio is 100%).
//
//   1. ساعات العمل      35  your expected hours ÷ the highest in the department
//   2. الالتزام بالموعد  20  tasks finished before the due date ÷ finished tasks
//   3. سرعة الإنجاز      15  tasks finished within the expected duration ÷ finished
//   4. ملاحظات المشرف    15  starts at 10, +1 per positive, −2 per negative, 0..15
//   5. عدد المهام         5  your finished tasks ÷ the highest in the department
//   6. إرفاق الصور       10  finished tasks carrying a photo ÷ finished tasks
//
// Each department is ranked against itself (cleaning vs cleaning), because
// criteria 1 and 5 are relative to the department's own maximum.
//
// Criteria 1 and 3 need data recorded when the task is created / finished
// (expectedHours, actualHours). Tasks without it are EXCLUDED from those two
// criteria rather than assumed — the note says how many tasks were counted, so
// a thin sample is visible instead of silently scoring zero.
// ─────────────────────────────────────────────────────────────────────────────

/** Weight of each criterion; they add up to 100. */
export const CRITERIA_WEIGHTS = {
  workHours: 35,
  onTime: 20,
  speed: 15,
  supervisorNotes: 15,
  taskCount: 5,
  photos: 10,
} as const;

export type CriterionKey = keyof typeof CRITERIA_WEIGHTS;

/** Supervisor-notes criterion: everyone starts here, then notes move it. */
const NOTES_BASELINE = 10;
const NOTES_POSITIVE = 1;
const NOTES_NEGATIVE = 2;

/** Minimum total to be crowned employee of the week. */
export const EMPLOYEE_OF_WEEK_MIN_SCORE = 75;

/** Performance bands shown next to the total. */
export type PerformanceBand = "EXCELLENT" | "GOOD" | "NEEDS_FOLLOW_UP" | "NEEDS_WARNING";
export function performanceBand(total: number): PerformanceBand {
  if (total >= 85) return "EXCELLENT";
  if (total >= 70) return "GOOD";
  if (total >= 55) return "NEEDS_FOLLOW_UP";
  return "NEEDS_WARNING";
}

export type CriterionScore = {
  key: CriterionKey;
  labelEn: string;
  labelAr: string;
  score: number;
  max: number;
  /** Short explanation of how the score was reached, e.g. "24 ÷ 24 ساعة". */
  note: string;
};

export type LeaderboardEmployee = {
  id: string;
  name: string;
  role: string;
  /** The department this employee was ranked within (their role). */
  department: string;
  location: string;
  taskCount: number;
  dateRange: string;
  totalScore: number;
  rank: number;
  totalEmployees: number;
  isEmployeeOfWeek: boolean;
  band: PerformanceBand;
  criteria: CriterionScore[];
  supervisorNotes: {
    id: string;
    text: string;
    category: string;
    timeAgo: string;
    type: "positive" | "negative";
  }[];
};

const FINISHED_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED"];

const RANKED_ROLES = ["HOUSEKEEPING", "MAINTENANCE", "RECEPTIONIST", "SUPERVISOR", "MANAGER"] as const;

const ARABIC_ROLES: Record<string, string> = {
  HOUSEKEEPING: "تنظيف",
  MAINTENANCE: "صيانة",
  RECEPTIONIST: "استقبال",
  SUPERVISOR: "مشرف",
  MANAGER: "مدير",
};

const CRITERION_LABELS: Record<CriterionKey, { en: string; ar: string }> = {
  workHours: { en: "Work hours", ar: "ساعات العمل" },
  onTime: { en: "On time", ar: "الالتزام بالموعد" },
  speed: { en: "Completion speed", ar: "سرعة الإنجاز" },
  supervisorNotes: { en: "Supervisor notes", ar: "ملاحظات المشرف" },
  taskCount: { en: "Task count", ar: "عدد المهام" },
  photos: { en: "Photos attached", ar: "إرفاق الصور" },
};

const round1 = (n: number) => Math.round(n * 10) / 10;
/** score = ratio × weight, never above the weight. */
const scoreOf = (part: number, whole: number, weight: number) =>
  whole > 0 ? round1(Math.min(1, part / whole) * weight) : 0;

/** Per-employee tallies gathered from their finished tasks. */
type Tally = {
  finished: number;
  /** Expected hours summed over finished tasks that recorded them. */
  hours: number;
  hoursTasks: number;
  onTime: number;
  /** Tasks that can be judged on time (a completion time and a due date). */
  onTimeTasks: number;
  withinExpected: number;
  /** Tasks with both an expected and an actual duration. */
  speedTasks: number;
  withPhotos: number;
  positiveNotes: number;
  negativeNotes: number;
  /** LARGE tasks still awaiting a manager's size approval (counted as medium). */
  pendingLargeTasks: number;
};

const newTally = (): Tally => ({
  finished: 0, hours: 0, hoursTasks: 0, onTime: 0, onTimeTasks: 0,
  withinExpected: 0, speedTasks: 0, withPhotos: 0, positiveNotes: 0, negativeNotes: 0,
  pendingLargeTasks: 0,
});

/**
 * Ranks employees for the period ending `offsetDays` ago, `days` long.
 * `buildingId` narrows to staff assigned to those buildings.
 */
export async function getEmployeeRanking(
  days: number = 7,
  offsetDays: number = 0,
  buildingId?: string | string[],
): Promise<LeaderboardEmployee[]> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - offsetDays);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  const now = new Date();
  const dateRangeStr = `من ${startDate.getDate()}/${startDate.getMonth() + 1} إلى ${endDate.getDate()}/${endDate.getMonth() + 1}`;

  const userWhere: Record<string, unknown> = { role: { in: [...RANKED_ROLES] } };
  if (buildingId) {
    userWhere.assignedBuildings = Array.isArray(buildingId)
      ? { some: { buildingId: { in: buildingId } } }
      : { some: { buildingId } };
  }

  const users = await prisma.adminUser.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      assignedBuildings: { include: { building: true }, take: 1 },
      assignedTasks: {
        where: {
          status: { in: FINISHED_STATUSES },
          // Finished within the period. completedAt is authoritative; older
          // tasks predate it, so updatedAt stands in.
          OR: [
            { completedAt: { gte: startDate, lte: endDate } },
            { completedAt: null, updatedAt: { gte: startDate, lte: endDate } },
          ],
        },
        select: {
          dueDate: true, updatedAt: true, completedAt: true,
          expectedHours: true, actualHours: true,
          taskSize: true, sizeApprovedAt: true,
          _count: { select: { photos: true } },
        },
      },
      receivedNotes: { where: { createdAt: { gte: startDate, lte: endDate } } },
    },
  });

  // ── Tally each employee's finished work ───────────────────────────────────
  const tallies = new Map<string, Tally>();
  for (const user of users) {
    const tally = newTally();
    for (const task of user.assignedTasks) {
      tally.finished++;
      if (task._count.photos > 0) tally.withPhotos++;

      // 1. Work hours — the expected duration written when the task was created.
      // A LARGE task counts as medium until a manager approves its size, so an
      // inflated estimate cannot lift a rating on its own.
      const creditedHours = effectiveExpectedHours(task.expectedHours, task.taskSize, task.sizeApprovedAt);
      if (typeof creditedHours === "number") {
        tally.hours += creditedHours;
        tally.hoursTasks++;
        if (task.taskSize === "LARGE" && !task.sizeApprovedAt) tally.pendingLargeTasks++;
      }

      // 2. On time — measured on the real completion time, not a later edit.
      const finishedAt = task.completedAt ?? task.updatedAt;
      if (finishedAt) {
        tally.onTimeTasks++;
        if (finishedAt <= task.dueDate) tally.onTime++;
      }

      // 3. Speed — finished within the duration estimated for the task.
      if (typeof task.expectedHours === "number" && typeof task.actualHours === "number") {
        tally.speedTasks++;
        if (task.actualHours <= task.expectedHours) tally.withinExpected++;
      }
    }
    for (const note of user.receivedNotes) {
      if (note.isPositive) tally.positiveNotes++;
      else tally.negativeNotes++;
    }
    tallies.set(user.id, tally);
  }

  // ── Department maxima (criteria 1 and 5 are relative) ─────────────────────
  // Only employees with finished work count towards a department's maximum.
  const deptMax = new Map<string, { hours: number; tasks: number }>();
  for (const user of users) {
    const tally = tallies.get(user.id)!;
    if (tally.finished === 0) continue;
    const max = deptMax.get(user.role) ?? { hours: 0, tasks: 0 };
    max.hours = Math.max(max.hours, tally.hours);
    max.tasks = Math.max(max.tasks, tally.finished);
    deptMax.set(user.role, max);
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  const leaderboard: LeaderboardEmployee[] = [];
  for (const user of users) {
    const tally = tallies.get(user.id)!;
    // Anyone without a finished task this period is not ranked.
    if (tally.finished === 0) continue;

    const max = deptMax.get(user.role) ?? { hours: 0, tasks: 0 };

    // 4. Supervisor notes — a fixed baseline moved by the notes received.
    const notesRaw = NOTES_BASELINE + tally.positiveNotes * NOTES_POSITIVE - tally.negativeNotes * NOTES_NEGATIVE;
    const notesScore = round1(Math.max(0, Math.min(CRITERIA_WEIGHTS.supervisorNotes, notesRaw)));

    const criteria: CriterionScore[] = [
      {
        key: "workHours",
        ...labels("workHours"),
        score: scoreOf(tally.hours, max.hours, CRITERIA_WEIGHTS.workHours),
        max: CRITERIA_WEIGHTS.workHours,
        note: tally.hoursTasks === 0
          ? "لا مدد متوقعة مسجّلة"
          : `${round1(tally.hours)} من ${round1(max.hours)} ساعة` +
            (tally.hoursTasks < tally.finished ? ` (${tally.hoursTasks}/${tally.finished} مهمة)` : "") +
            (tally.pendingLargeTasks > 0 ? ` • ${tally.pendingLargeTasks} كبيرة بانتظار الاعتماد` : ""),
      },
      {
        key: "onTime",
        ...labels("onTime"),
        score: scoreOf(tally.onTime, tally.onTimeTasks, CRITERIA_WEIGHTS.onTime),
        max: CRITERIA_WEIGHTS.onTime,
        note: tally.onTimeTasks === 0
          ? "—"
          : `${tally.onTime} من ${tally.onTimeTasks} في الموعد`,
      },
      {
        key: "speed",
        ...labels("speed"),
        score: scoreOf(tally.withinExpected, tally.speedTasks, CRITERIA_WEIGHTS.speed),
        max: CRITERIA_WEIGHTS.speed,
        note: tally.speedTasks === 0
          ? "لا مدد فعلية مسجّلة"
          : `${tally.withinExpected} من ${tally.speedTasks} ضمن المدة`,
      },
      {
        key: "supervisorNotes",
        ...labels("supervisorNotes"),
        score: notesScore,
        max: CRITERIA_WEIGHTS.supervisorNotes,
        note: tally.positiveNotes === 0 && tally.negativeNotes === 0
          ? `${NOTES_BASELINE} (بدون ملاحظات)`
          : `${NOTES_BASELINE} + ${tally.positiveNotes} إيجابية − ${tally.negativeNotes} سلبية`,
      },
      {
        key: "taskCount",
        ...labels("taskCount"),
        score: scoreOf(tally.finished, max.tasks, CRITERIA_WEIGHTS.taskCount),
        max: CRITERIA_WEIGHTS.taskCount,
        note: `${tally.finished} من ${max.tasks} مهمة`,
      },
      {
        key: "photos",
        ...labels("photos"),
        score: scoreOf(tally.withPhotos, tally.finished, CRITERIA_WEIGHTS.photos),
        max: CRITERIA_WEIGHTS.photos,
        note: `${tally.withPhotos} من ${tally.finished} بصور`,
      },
    ];

    const totalScore = round1(criteria.reduce((sum, c) => sum + c.score, 0));

    const criteriaAr: Record<string, string> = {
      timeAdherence: "الالتزام بالوقت",
      workQuality: "جودة العمل",
      docAndResponse: "التوثيق والاستجابة",
      productivity: "حجم الإنتاجية",
      general: "عام",
    };

    leaderboard.push({
      id: user.id,
      name: user.name || user.email.split("@")[0],
      role: ARABIC_ROLES[user.role] || user.role,
      department: user.role,
      location: user.assignedBuildings.length > 0
        ? (user.assignedBuildings[0].building.nameAr || user.assignedBuildings[0].building.nameEn)
        : "عام",
      taskCount: tally.finished,
      dateRange: dateRangeStr,
      totalScore,
      rank: 0,
      totalEmployees: 0,
      isEmployeeOfWeek: false,
      band: performanceBand(totalScore),
      criteria,
      supervisorNotes: user.receivedNotes.slice(0, 4).map((n) => ({
        id: n.id,
        text: n.text,
        category: criteriaAr[n.criteria] || n.criteria,
        timeAgo: "منذ " + Math.round((now.getTime() - n.createdAt.getTime()) / 36e5) + " ساعة",
        type: n.isPositive ? ("positive" as const) : ("negative" as const),
      })),
    });
  }

  leaderboard.sort((a, b) => b.totalScore - a.totalScore);
  leaderboard.forEach((emp, index) => {
    emp.rank = index + 1;
    emp.totalEmployees = leaderboard.length;
  });

  // Employee of the week: the best in each department, if they clear the bar.
  // Departments are scored against their own maximum, so a single cross-company
  // winner would just favour whichever department had the biggest jobs.
  const crowned = new Set<string>();
  for (const emp of leaderboard) {
    if (crowned.has(emp.department)) continue;
    if (emp.totalScore >= EMPLOYEE_OF_WEEK_MIN_SCORE) {
      emp.isEmployeeOfWeek = true;
      crowned.add(emp.department);
    }
  }

  return leaderboard;
}

function labels(key: CriterionKey) {
  return { labelEn: CRITERION_LABELS[key].en, labelAr: CRITERION_LABELS[key].ar };
}
