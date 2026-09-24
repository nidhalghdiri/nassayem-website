import prisma from "@/lib/prisma";
import type { TaskStatus, StaffRole } from "@prisma/client";

export type LeaderboardEmployee = {
  id: string;
  name: string;
  role: string;
  location: string;
  taskCount: number;
  dateRange: string;
  totalScore: number;
  rank: number;
  totalEmployees: number;
  isEmployeeOfWeek: boolean;
  productivity: { score: number; note: string };
  timeAdherence: { score: number; note: string };
  workQuality: { score: number; note: string };
  docAndResponse: { score: number; note: string };
  supervisorEval: { score: number; note: string };
  supervisorNotes: {
    id: string;
    text: string;
    category: string;
    timeAgo: string;
    type: "positive" | "negative";
  }[];
};

const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED"];

export async function getEmployeeRanking(days: number = 7, offsetDays: number = 0, buildingId?: string): Promise<LeaderboardEmployee[]> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - offsetDays);
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  
  const now = new Date();
  const dateRangeStr = `من ${startDate.getDate()}/${startDate.getMonth() + 1} إلى ${endDate.getDate()}/${endDate.getMonth() + 1}`;

  const userWhereClause: any = {
    role: { in: ["HOUSEKEEPING", "MAINTENANCE", "RECEPTIONIST", "SUPERVISOR", "MANAGER"] }
  };
  
  if (buildingId) {
    userWhereClause.assignedBuildings = {
      some: { buildingId }
    };
  }

  const users = await prisma.adminUser.findMany({
    where: userWhereClause,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      assignedBuildings: {
        include: { building: true },
        take: 1
      },
      assignedTasks: {
        where: {
          OR: [
            { createdAt: { gte: startDate, lte: endDate } },
            { updatedAt: { gte: startDate, lte: endDate } },
            { dueDate: { gte: startDate, lte: endDate } },
            { 
              status: { notIn: [...TERMINAL_STATUSES, "CANCELLED"] },
              createdAt: { lte: endDate }
            }
          ]
        },
        include: {
          activities: { orderBy: { createdAt: 'asc' } }, // Get activities ordered by time
          notes: {
            include: { user: { select: { role: true, name: true } } }
          },
          photos: true,
          createdBy: { select: { role: true } }
        }
      }
    }
  });

  const leaderboard: LeaderboardEmployee[] = [];
  const arabicRoles: Record<string, string> = {
    "HOUSEKEEPING": "تنظيف",
    "MAINTENANCE": "صيانة",
    "RECEPTIONIST": "استقبال",
    "SUPERVISOR": "مشرف",
    "MANAGER": "مدير"
  };

  let totalTasksCompletedByTeam = 0;
  let activeUsersCount = 0;
  for (const u of users) {
    const cTasks = u.assignedTasks.filter(t => TERMINAL_STATUSES.includes(t.status as TaskStatus) && t.updatedAt >= startDate && t.updatedAt <= endDate).length;
    const aTasks = u.assignedTasks.filter(t => !TERMINAL_STATUSES.includes(t.status as TaskStatus) && t.status !== "CANCELLED" && t.createdAt <= endDate).length;
    
    // Only count employees who have at least one active or completed task in the period
    if (cTasks > 0 || aTasks > 0) {
      activeUsersCount++;
      totalTasksCompletedByTeam += cTasks;
    }
  }
  const teamAverageTasks = activeUsersCount > 0 ? (totalTasksCompletedByTeam / activeUsersCount) : 1;

  for (const user of users) {
    const relevantTasks = user.assignedTasks;
    const completedTasks = relevantTasks.filter(t => TERMINAL_STATUSES.includes(t.status as TaskStatus) && t.updatedAt >= startDate && t.updatedAt <= endDate);
    const activeTasks = relevantTasks.filter(t => !TERMINAL_STATUSES.includes(t.status as TaskStatus) && t.status !== "CANCELLED" && t.createdAt <= endDate);
    
    if (completedTasks.length === 0 && activeTasks.length === 0) continue;

    const taskCount = completedTasks.length;
    
    // 1. Productivity Volume (Max 30)
    let prodScore = 0;
    if (taskCount > 0) {
      // If team average is 0, just give max points. Otherwise scale to average
      const ratio = teamAverageTasks > 0 ? (taskCount / teamAverageTasks) : 1;
      prodScore = Math.min(30, ratio * 30);
    }
    const prodNote = `${taskCount} مهام (المتوسط ${teamAverageTasks.toFixed(1)})`;

    // 2. Time Adherence (Max 30)
    let timeScore = 0;
    let onTimeCount = 0;
    for (const task of completedTasks) {
      if (task.updatedAt <= task.dueDate) {
        onTimeCount++;
      }
    }
    const overdueCount = activeTasks.filter(t => t.dueDate < now).length;
    
    if (taskCount > 0) {
      let timePct = (onTimeCount / taskCount);
      timeScore = Math.max(0, (timePct * 30) - (overdueCount * 2));
    } else if (overdueCount > 0) {
      timeScore = 0;
    } else {
      timeScore = 30; // no tasks, no delays
    }
    const timePctStr = taskCount > 0 ? Math.round((onTimeCount / taskCount) * 100) : 100;
    const timeNote = overdueCount > 0 ? `${timePctStr}% في الموعد - ${overdueCount} متأخرة` : `${timePctStr}% في الموعد`;

    // 3. Work Quality (Max 20)
    let totalStars = 0;
    let starRatedTasksCount = 0;

    for (const task of completedTasks) {
      const starNotes = task.notes.filter(n => n.text.startsWith("★"));
      if (starNotes.length > 0) {
        // Get the most recent star note
        const latestNote = starNotes[starNotes.length - 1];
        const match = latestNote.text.match(/★(\d+)/);
        if (match) {
          totalStars += parseInt(match[1]);
          starRatedTasksCount++;
        }
      }
    }

    let qualityScore = 0;
    let averageStars = 5; // Default to 5 if no tasks are audited yet
    if (starRatedTasksCount > 0) {
      averageStars = totalStars / starRatedTasksCount;
    }

    if (taskCount > 0) {
      qualityScore = (averageStars / 5) * 20;
    } else {
      qualityScore = 20; // Base score if no tasks
    }
    const qualityNote = `★${averageStars.toFixed(1)}`;

    // 4. Documentation & Response (Max 10)
    // 5 points for photos on tasks, 5 points for fast response
    let photoPoints = 0;
    let responsePoints = 0;
    let tasksWithPhotos = 0;
    let tasksWithFastResponse = 0;

    for (const task of completedTasks) {
      if (task.photos && task.photos.length > 0) tasksWithPhotos++;
      
      // Response Speed: Check if they performed an activity within 30 minutes of creation
      const firstActivity = task.activities.find(a => a.userId === user.id);
      if (firstActivity) {
        const timeDiffMins = (firstActivity.createdAt.getTime() - task.createdAt.getTime()) / (1000 * 60);
        if (timeDiffMins <= 30) {
          tasksWithFastResponse++;
        }
      }
    }

    if (taskCount > 0) {
      photoPoints = (tasksWithPhotos / taskCount) * 5;
      responsePoints = (tasksWithFastResponse / taskCount) * 5;
    } else {
      photoPoints = 5;
      responsePoints = 5;
    }
    const docScore = photoPoints + responsePoints;
    const docNote = `${tasksWithPhotos} صور، ${tasksWithFastResponse} استجابة سريعة`;

    // 5. Supervisor Evaluation (Max 10)
    let supScore = 5; // baseline
    const supervisorNotes: LeaderboardEmployee["supervisorNotes"] = [];
    
    for (const task of relevantTasks) {
      const positiveNotes = task.notes.filter(n => {
        if (n.userId === user.id || !["SUPERVISOR", "MANAGER"].includes(n.user.role)) return false;
        
        // If it's a rating note, only consider 4 or 5 stars as a "positive" bonus note
        if (n.text.startsWith("★")) {
          const match = n.text.match(/★(\d+)/);
          if (match && parseInt(match[1]) < 4) return false;
        }
        return true;
      });
      
      for (const n of positiveNotes) {
        supScore = Math.min(10, supScore + 2.5);
        supervisorNotes.push({
          id: n.id,
          text: n.text,
          category: "تقييم المشرف",
          timeAgo: "منذ " + Math.round((now.getTime() - n.createdAt.getTime()) / (1000 * 60 * 60)) + " ساعة",
          type: "positive"
        });
      }
    }
    const supNote = supScore > 5 ? `+${(supScore - 5).toFixed(1)}` : (supScore < 5 ? `${(supScore - 5).toFixed(1)}` : "أساسي");

    const totalScore = prodScore + timeScore + qualityScore + docScore + supScore;
    const displayName = user.name || user.email.split('@')[0];
    const locationName = user.assignedBuildings.length > 0 ? (user.assignedBuildings[0].building.nameAr || user.assignedBuildings[0].building.nameEn) : "عام";

    leaderboard.push({
      id: user.id,
      name: displayName,
      role: arabicRoles[user.role] || user.role,
      location: locationName,
      taskCount,
      dateRange: dateRangeStr,
      totalScore: Number(totalScore.toFixed(1)),
      rank: 0,
      totalEmployees: 0,
      isEmployeeOfWeek: false,
      productivity: { score: Number(prodScore.toFixed(1)), note: prodNote },
      timeAdherence: { score: Number(timeScore.toFixed(1)), note: timeNote },
      workQuality: { score: Number(qualityScore.toFixed(1)), note: qualityNote },
      docAndResponse: { score: Number(docScore.toFixed(1)), note: docNote },
      supervisorEval: { score: Number(supScore.toFixed(1)), note: supNote },
      supervisorNotes: supervisorNotes.slice(0, 4) // cap to 4 for UI
    });
  }

  // Filter out any employees that somehow made it through without tasks
  const filteredLeaderboard = leaderboard.filter(emp => emp.taskCount > 0 || (emp.totalScore > 0 && emp.totalScore !== 70)); // Or any other strict check, but actually we skipped them on line 112 already.
  // Wait, line 112 is: if (completedTasks.length === 0 && activeTasks.length === 0) continue;
  // This already filters them out!
  
  filteredLeaderboard.sort((a, b) => b.totalScore - a.totalScore);
  
  const totalEmps = filteredLeaderboard.length;
  filteredLeaderboard.forEach((emp, index) => {
    emp.rank = index + 1;
    emp.totalEmployees = totalEmps;
    if (index === 0 && emp.totalScore >= 70 && totalEmps > 0) {
      emp.isEmployeeOfWeek = true;
    }
  });

  return filteredLeaderboard.slice(0, 7); // Return top 7
}
