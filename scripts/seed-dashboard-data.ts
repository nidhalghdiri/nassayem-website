import { PrismaClient, TaskType, TaskStatus, TaskPriority } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding dashboard test data...');

  // 1. Get available users (Staff)
  const staff = await prisma.adminUser.findMany({
    where: { role: { in: ["HOUSEKEEPING", "MAINTENANCE", "RECEPTIONIST"] } }
  });

  const supervisors = await prisma.adminUser.findMany({
    where: { role: { in: ["SUPERVISOR", "MANAGER"] } }
  });

  if (staff.length === 0 || supervisors.length === 0) {
    console.error('No staff or supervisors found! Please ensure users exist.');
    return;
  }

  // 2. Get buildings and units
  const buildings = await prisma.building.findMany({ include: { units: true } });
  if (buildings.length === 0) {
    console.error('No buildings found!');
    return;
  }

  // Clear recent tasks (optional, maybe just create new ones to ensure clean test data)
  // Let's just create 10-15 tasks for the first 3 staff members.
  
  const now = new Date();
  const testStaff = staff.slice(0, 3);
  
  for (let i = 0; i < testStaff.length; i++) {
    const user = testStaff[i];
    const building = buildings[i % buildings.length];
    const unit = building.units.length > 0 ? building.units[0] : null;
    const supervisor = supervisors[0];
    
    console.log(`Generating tasks for ${user.name || user.email}...`);

    // Create 3 tasks per user to test different scenarios:
    // Task 1: Perfect score (On time, Clean, Photos, Fast Response, Positive Note)
    const t1Created = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)); // 2 days ago
    const t1Due = new Date(t1Created.getTime() + (2 * 60 * 60 * 1000)); // due in 2 hours
    const t1Completed = new Date(t1Created.getTime() + (1 * 60 * 60 * 1000)); // completed in 1 hour
    const t1FastActivity = new Date(t1Created.getTime() + (15 * 60 * 1000)); // responded in 15 mins
    
    await prisma.task.create({
      data: {
        type: TaskType.CLEANING,
        title: 'تنظيف عميق - مثال',
        description: 'اختبار لوحة القيادة (درجة كاملة)',
        buildingId: building.id,
        status: TaskStatus.NO_ISSUES,
        priority: TaskPriority.HIGH,
        createdById: supervisor.id,
        assignedToId: user.id,
        createdAt: t1Created,
        updatedAt: t1Completed,
        dueDate: t1Due,
        activities: {
          create: [
            { userId: user.id, action: 'status_changed', details: 'Started cleaning', createdAt: t1FastActivity }
          ]
        },
        photos: {
          create: [
            { userId: user.id, photoUrl: 'https://example.com/photo.jpg', createdAt: t1Completed }
          ]
        },
        notes: {
          create: [
            { userId: supervisor.id, text: 'عمل ممتاز وسريع جداً!', createdAt: t1Completed }
          ]
        }
      }
    });

    // Task 2: Delayed & No Photos & Slow Response
    const t2Created = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000)); // 4 days ago
    const t2Due = new Date(t2Created.getTime() + (24 * 60 * 60 * 1000)); // due in 24 hours
    const t2Completed = new Date(t2Created.getTime() + (48 * 60 * 60 * 1000)); // completed in 48 hours (late)
    const t2SlowActivity = new Date(t2Created.getTime() + (2 * 60 * 60 * 1000)); // responded in 2 hours
    
    await prisma.task.create({
      data: {
        type: TaskType.MAINTENANCE,
        title: 'إصلاح تكييف - مثال',
        description: 'اختبار لوحة القيادة (درجة منخفضة)',
        buildingId: building.id,
        status: TaskStatus.WORK_COMPLETED,
        priority: TaskPriority.MEDIUM,
        createdById: supervisor.id,
        assignedToId: user.id,
        createdAt: t2Created,
        updatedAt: t2Completed,
        dueDate: t2Due,
        activities: {
          create: [
            { userId: user.id, action: 'status_changed', details: 'Started work', createdAt: t2SlowActivity }
          ]
        },
        // NO photos, NO supervisor notes
      }
    });

    // Task 3: Active and Overdue (Penalizes time adherence)
    const t3Created = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000)); // 5 days ago
    const t3Due = new Date(t3Created.getTime() + (24 * 60 * 60 * 1000)); // due in 1 day (4 days ago = overdue)
    
    await prisma.task.create({
      data: {
        type: TaskType.WORK_ORDER,
        title: 'طلب صيانة عاجل - مثال',
        description: 'اختبار لوحة القيادة (مهمة متأخرة)',
        buildingId: building.id,
        
        status: TaskStatus.IN_PROGRESS, // Active, not completed
        priority: TaskPriority.URGENT,
        createdById: supervisor.id,
        assignedToId: user.id,
        createdAt: t3Created,
        updatedAt: t3Created,
        dueDate: t3Due,
        activities: {
          create: [
            { userId: user.id, action: 'status_changed', details: 'Started work', createdAt: t3Created }
          ]
        }
      }
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
