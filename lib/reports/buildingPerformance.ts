import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

export type BuildingPerformance = {
  id: string;
  labelEn: string;
  labelAr: string;
  val: number;
  color: string;
};

const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED"];

export async function getBuildingPerformance(days: number = 30): Promise<BuildingPerformance[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      shortName: true,
      tasks: {
        where: {
          dueDate: { gte: startDate },
          status: { in: TERMINAL_STATUSES }
        },
        select: {
          dueDate: true,
          updatedAt: true
        }
      }
    }
  });

  const results: BuildingPerformance[] = [];

  for (const b of buildings) {
    const totalTasks = b.tasks.length;
    if (totalTasks === 0) continue; // Skip buildings with no completed tasks due in this period

    let onTimeTasks = 0;
    for (const task of b.tasks) {
      if (task.updatedAt <= task.dueDate) {
        onTimeTasks++;
      }
    }

    const val = Math.round((onTimeTasks / totalTasks) * 100);
    
    let color = "bg-nassayem"; // default
    if (val >= 90) color = "bg-teal-600";
    else if (val >= 80) color = "bg-teal-700";
    else if (val >= 75) color = "bg-amber-600";
    else color = "bg-red-600";

    results.push({
      id: b.id,
      labelEn: b.shortName || b.nameEn,
      labelAr: b.nameAr,
      val,
      color
    });
  }

  // Sort by performance descending
  results.sort((a, b) => b.val - a.val);

  return results;
}
