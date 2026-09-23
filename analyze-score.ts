import { getEmployeeRanking } from './lib/reports/employeeRanking';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leaderboard = await getEmployeeRanking(7);
  
  const user = leaderboard.find(e => e.name.includes("امداد") || e.name.includes("انصار"));
  
  if (!user) {
    console.log("User not found in leaderboard.");
    console.log("Leaderboard names:", leaderboard.map(l => l.name));
    return;
  }
  
  console.log("---- LEADERBOARD DATA ----");
  console.log(JSON.stringify(user, null, 2));

  console.log("\n---- RAW DB DATA ----");
  // Fetch raw tasks to show WHY
  const dbUser = await prisma.adminUser.findUnique({
    where: { id: user.id },
    include: {
      assignedTasks: {
        include: {
          activities: true,
          photos: true,
          notes: true
        }
      }
    }
  });

  const now = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const relevantTasks = dbUser?.assignedTasks.filter(t => 
    t.createdAt >= startDate || t.updatedAt >= startDate || t.dueDate >= startDate || 
    !["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"].includes(t.status)
  ) || [];

  console.log(`Total Relevant Tasks: ${relevantTasks.length}`);
  
  for (const t of relevantTasks) {
    console.log(`\nTask: ${t.title} (Status: ${t.status})`);
    console.log(`Created: ${t.createdAt.toISOString()}`);
    console.log(`Due: ${t.dueDate.toISOString()}`);
    console.log(`Updated: ${t.updatedAt.toISOString()}`);
    console.log(`Photos count: ${t.photos.length}`);
    const firstAct = t.activities.sort((a,b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (firstAct) {
       const diff = (firstAct.createdAt.getTime() - t.createdAt.getTime()) / (1000 * 60);
       console.log(`First Activity after: ${diff.toFixed(1)} mins`);
    } else {
       console.log(`First Activity after: NONE`);
    }
    console.log(`Notes count: ${t.notes.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
