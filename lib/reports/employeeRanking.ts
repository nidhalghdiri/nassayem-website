import prisma from "@/lib/prisma";
import type { TaskStatus, StaffRole } from "@prisma/client";

export type LeaderboardEmployee = {
  id: string;
  name: string;
  role: StaffRole;
  score: number;
  best?: boolean;
  initial: string;
  breakdown: {
    productivity: number;
    completion: number;
    initiative: number;
    collaboration: number;
  };
};

const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED"];

export async function getEmployeeRanking(days: number = 7): Promise<LeaderboardEmployee[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const now = new Date();

  // Fetch active staff with their tasks that were active/completed in the last X days
  const users = await prisma.adminUser.findMany({
    where: {
      role: { in: ["HOUSEKEEPING", "MAINTENANCE", "RECEPTIONIST", "SUPERVISOR", "MANAGER"] }
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      assignedTasks: {
        where: {
          OR: [
            { createdAt: { gte: startDate } },
            { updatedAt: { gte: startDate } },
            { dueDate: { gte: startDate } },
            { status: { notIn: [...TERMINAL_STATUSES, "CANCELLED"] } } // Active tasks (overdue check)
          ]
        },
        include: {
          activities: true,
          notes: true,
          photos: true,
          createdBy: { select: { role: true } }
        }
      }
    }
  });

  const leaderboard: LeaderboardEmployee[] = [];

  for (const user of users) {
    let productivityScore = 0;
    let completionScore = 0;
    let initiativeScore = 0;
    let collaborationScore = 0;

    const relevantTasks = user.assignedTasks;
    const completedTasks = relevantTasks.filter(t => TERMINAL_STATUSES.includes(t.status as TaskStatus) && t.updatedAt >= startDate);
    const activeTasks = relevantTasks.filter(t => !TERMINAL_STATUSES.includes(t.status as TaskStatus) && t.status !== "CANCELLED");
    
    // Skip if they have no involvement in the last 7 days
    if (completedTasks.length === 0 && activeTasks.length === 0) continue;

    // 1. Productivity & Speed (25%) - Reaction time
    let reactionTimeScores = 0;
    let reactionTimeCount = 0;
    
    for (const task of relevantTasks) {
      if (task.createdAt >= startDate) {
        // Find first activity by THIS user
        const firstActivity = task.activities.find(a => a.userId === user.id);
        if (firstActivity) {
          const diffMs = firstActivity.createdAt.getTime() - task.createdAt.getTime();
          const diffMins = diffMs / (1000 * 60);
          
          if (diffMins <= 30) reactionTimeScores += 100;
          else if (diffMins <= 120) reactionTimeScores += 80;
          else if (diffMins <= 720) reactionTimeScores += 50;
          else reactionTimeScores += 0;
        } else {
          // No activity yet
          reactionTimeScores += 0;
        }
        reactionTimeCount++;
      }
    }
    productivityScore = reactionTimeCount > 0 ? (reactionTimeScores / reactionTimeCount) : 0;
    if (reactionTimeCount === 0 && completedTasks.length > 0) productivityScore = 80; // default if no tasks created recently but completed some

    // 2. Task Completion (35%)
    let onTimeCount = 0;
    for (const task of completedTasks) {
      if (task.updatedAt <= task.dueDate) {
        onTimeCount++;
      }
    }
    let baseCompletion = completedTasks.length > 0 ? (onTimeCount / completedTasks.length) * 100 : 0;
    
    // Penalty for overdue active tasks
    const overdueCount = activeTasks.filter(t => t.dueDate < now).length;
    baseCompletion = Math.max(0, baseCompletion - (overdueCount * 10)); // -10 points per overdue task
    if (completedTasks.length === 0 && overdueCount > 0) baseCompletion = 0;
    else if (completedTasks.length === 0) baseCompletion = 100; // default if no tasks completed but none overdue

    completionScore = baseCompletion;

    // 3. Initiative & Problem Solving (20%)
    let totalNotesPhotos = 0;
    for (const task of completedTasks) {
      const userNotes = task.notes.filter(n => n.userId === user.id).length;
      const userPhotos = task.photos.filter(p => p.userId === user.id).length;
      totalNotesPhotos += (userNotes + userPhotos);
    }
    const avgNotesPhotos = completedTasks.length > 0 ? totalNotesPhotos / completedTasks.length : 0;
    // Cap at 1.0 avg for 100 points
    initiativeScore = completedTasks.length > 0 ? Math.min(100, (avgNotesPhotos / 1.0) * 100) : 0;

    // 4. Team Collaboration (20%)
    let collabCount = 0;
    for (const task of relevantTasks) {
      if (task.createdBy.role === "SUPERVISOR" || task.createdBy.role === "MANAGER") {
        const hasInteracted = task.activities.some(a => a.userId === user.id);
        if (hasInteracted) collabCount++;
      }
    }
    // Baseline: say 3 collaborative interactions a week is 100
    collaborationScore = Math.min(100, (collabCount / 3) * 100);

    // Weighted Total
    const totalScore = 
      (productivityScore * 0.25) + 
      (completionScore * 0.35) + 
      (initiativeScore * 0.20) + 
      (collaborationScore * 0.20);

    // Only include if they actually have a score > 0 and completed at least 1 task
    if (totalScore > 0 && completedTasks.length > 0) {
      const displayName = user.name || user.email.split('@')[0];
      leaderboard.push({
        id: user.id,
        name: displayName,
        role: user.role,
        score: Math.round(totalScore),
        initial: displayName.charAt(0).toUpperCase(),
        breakdown: {
          productivity: Math.round(productivityScore),
          completion: Math.round(completionScore),
          initiative: Math.round(initiativeScore),
          collaboration: Math.round(collaborationScore)
        }
      });
    }
  }

  // Sort descending
  leaderboard.sort((a, b) => b.score - a.score);

  // Top 5
  const top5 = leaderboard.slice(0, 5);
  if (top5.length > 0) {
    top5[0].best = true;
  }

  return top5;
}
