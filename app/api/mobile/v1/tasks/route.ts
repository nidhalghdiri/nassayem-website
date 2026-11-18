import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { mobileError, requireMobileUser } from "@/lib/mobileApi";
import { MOBILE_TASK_LIST_SELECT } from "@/lib/mobileTasks";
import { taskVisibilityWhere } from "@/lib/taskVisibility";
import { TERMINAL_STATUSES } from "@/lib/tasks/statuses";

const PAGE_SIZE = 25;
const DONE_WINDOW_DAYS = 30;

const ListQuery = z.object({
  view: z.enum(["open", "done"]).default("open"),
  /** "mine" = assigned to me; "all" = everything my role can see. */
  scope: z.enum(["mine", "all"]).default("mine"),
  type: z.enum(["CLEANING", "INSPECTION", "MAINTENANCE", "WORK_ORDER"]).optional(),
  cursor: z.string().optional(),
});

// ── GET /api/mobile/v1/tasks ─────────────────────────────────────────────────
// Paged task list for the app.
//   ?view=open  → not finished, soonest due first
//   ?view=done  → finished or cancelled in the last 30 days, newest first
//   ?scope=mine|all  ?type=CLEANING…  ?cursor=<nextCursor from the last page>
export async function GET(request: Request) {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return mobileError("VALIDATION", 400);
  const { view, scope, type, cursor } = parsed.data;

  const terminal = TERMINAL_STATUSES as TaskStatus[];
  const where: Prisma.TaskWhereInput = {
    AND: [
      await taskVisibilityWhere(user),
      scope === "mine" ? { assignedToId: user.id } : {},
      type ? { type } : {},
      view === "open"
        ? { status: { notIn: terminal } }
        : {
            status: { in: terminal },
            updatedAt: { gte: new Date(Date.now() - DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
          },
    ],
  };

  const rows = await prisma.task.findMany({
    where,
    select: MOBILE_TASK_LIST_SELECT,
    orderBy: view === "open" ? [{ dueDate: "asc" }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "asc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const tasks = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return NextResponse.json({
    tasks,
    nextCursor: hasMore ? tasks[tasks.length - 1].id : null,
  });
}
