const fs = require('fs');
const file = '/Users/marketing/Desktop/nassayem-website/nassayem-website/app/[locale]/admin/tasks/dashboard/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace the stats fetching block
const search = `    prisma.task.count({ where: { ...visibilityFilter } }),
    prisma.task.count({ where: { status: { in: ACTIVE_STATUSES }, ...visibilityFilter } }),
    prisma.task.count({ where: { status: { in: TERMINAL_STATUSES }, ...visibilityFilter } }),
    prisma.task.count({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: TERMINAL_STATUSES },
        ...visibilityFilter,
      },
    }),`;

const replace = `    prisma.task.count({ where: { ...visibilityFilter } }),
    prisma.task.count({ where: { status: { in: ACTIVE_STATUSES }, ...visibilityFilter } }),
    prisma.task.count({ where: { status: { in: TERMINAL_STATUSES }, ...visibilityFilter } }),
    prisma.task.count({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: TERMINAL_STATUSES },
        ...visibilityFilter,
      },
    }),
    prisma.task.count({
      where: {
        status: { in: ["CLEANING_COMPLETED", "WORK_COMPLETED"] },
        ...visibilityFilter,
      },
    }),
    prisma.task.findMany({
      where: { status: { in: TERMINAL_STATUSES }, ...visibilityFilter },
      select: { updatedAt: true, dueDate: true }
    }),
    (() => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      fourteenDaysAgo.setHours(0,0,0,0);
      return prisma.task.findMany({
        where: {
          status: { in: TERMINAL_STATUSES },
          updatedAt: { gte: fourteenDaysAgo },
          ...visibilityFilter
        },
        select: { updatedAt: true }
      });
    })(),`;

code = code.replace(search, replace);

// Update destructuring
const searchDestructuring = `    totalAssigned, 
    active, 
    completed, 
    delayed, 
    buildings, 
    staffUsers,`;
const replaceDestructuring = `    totalAssigned, 
    active, 
    completed, 
    delayed, 
    waitingAudit,
    allCompletedTasks,
    trendTasksRaw,
    buildings, 
    staffUsers,`;

code = code.replace(searchDestructuring, replaceDestructuring);

// Add calculation for timeAdherence and trendData
const searchStats = `  const stats = { totalAssigned, active, completed, delayed };`;
const replaceStats = `  let onTime = 0;
  for (const t of allCompletedTasks) {
    if (t.updatedAt <= t.dueDate) onTime++;
  }
  const timeAdherence = allCompletedTasks.length > 0 ? Math.round((onTime / allCompletedTasks.length) * 100) : 100;

  const trendMap = new Map<string, number>();
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    trendMap.set(d.toISOString().split('T')[0], 0);
  }
  for (const t of trendTasksRaw) {
    const dStr = t.updatedAt.toISOString().split('T')[0];
    if (trendMap.has(dStr)) {
      trendMap.set(dStr, trendMap.get(dStr)! + 1);
    }
  }
  const trendData = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

  const stats = { totalAssigned, active, completed, delayed, timeAdherence, waitingAudit };`;

code = code.replace(searchStats, replaceStats);

// Update props
const searchProps = `    stats,
    buildings,
    assignableStaff: staffUsers,`;
const replaceProps = `    stats,
    trendData,
    buildings,
    assignableStaff: staffUsers,`;

code = code.replace(searchProps, replaceProps);

fs.writeFileSync(file, code);
