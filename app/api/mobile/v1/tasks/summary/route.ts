import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { mobileError, requireMobileUser } from "@/lib/mobileApi";
import { taskVisibilityWhere } from "@/lib/taskVisibility";
import { TERMINAL_STATUSES } from "@/lib/tasks/statuses";

const SummaryQuery = z.object({
  /** "mine" = assigned to me; "all" = everything my role can see. */
  scope: z.enum(["mine", "all"]).default("mine"),
});

// Oman is UTC+4 all year (no daylight saving).
const OMAN_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── GET /api/mobile/v1/tasks/summary ─────────────────────────────────────────
// Counts for the app's home screen: open, overdue, due today (Oman time) and
// finished today.
export async function GET(request: Request) {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  const parsed = SummaryQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return mobileError("VALIDATION", 400);

  const base: Prisma.TaskWhereInput[] = [
    await taskVisibilityWhere(user),
    parsed.data.scope === "mine" ? { assignedToId: user.id } : {},
  ];
  const terminal = TERMINAL_STATUSES as TaskStatus[];
  const finished = terminal.filter((status) => status !== "CANCELLED");
  const open: Prisma.TaskWhereInput = { status: { notIn: terminal } };

  const now = new Date();
  const startOfDay = new Date(Math.floor((now.getTime() + OMAN_OFFSET_MS) / DAY_MS) * DAY_MS - OMAN_OFFSET_MS);
  const endOfDay = new Date(startOfDay.getTime() + DAY_MS);

  const count = (where: Prisma.TaskWhereInput) => prisma.task.count({ where: { AND: [...base, where] } });

  const [openCount, overdue, dueToday, doneToday] = await Promise.all([
    count(open),
    count({ ...open, dueDate: { lt: now } }),
    count({ ...open, dueDate: { gte: startOfDay, lt: endOfDay } }),
    count({ status: { in: finished }, completedAt: { gte: startOfDay } }),
  ]);

  return NextResponse.json({ open: openCount, overdue, dueToday, doneToday });
}
