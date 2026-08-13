import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const feedbacks = await prisma.campaignCustomer.findMany({
    where: {
      status: "DONE",
      summary: { not: null },
      subjects: { isEmpty: true }
    }
  });

  console.log(`Found ${feedbacks.length} feedbacks to process.`);

  for (const feedback of feedbacks) {
    if (!feedback.summary) continue;

    const summary = feedback.summary.toLowerCase();
    const subjects: string[] = [];

    // Simple keyword mapping based on the 15 records in the DB
    if (summary.includes("نظافة") || summary.includes("cleaning") || summary.includes("نظيف") || summary.includes("clean") || summary.includes("تنظيف")) {
      subjects.push("CLEANING");
    }
    if (summary.includes("أثاث") || summary.includes("furniture") || summary.includes("غسالة") || summary.includes("سرير") || summary.includes("washing") || summary.includes("bed") || summary.includes("سخان")) {
      subjects.push("MAINTENANCE");
    }
    if (summary.includes("استقبال") || summary.includes("موظف") || summary.includes("عبدالقادر") || summary.includes("staff") || summary.includes("تعامل") || summary.includes("متعاون") || summary.includes("reception")) {
      subjects.push("STAFF");
    }
    if (summary.includes("سعر") || summary.includes("أسعار") || summary.includes("price") || summary.includes("pricing") || summary.includes("أغلى")) {
      subjects.push("PRICING");
    }
    if (summary.includes("صور") || summary.includes("تغيير رقم") || summary.includes("pictures") || summary.includes("reality")) {
      subjects.push("MISREPRESENTATION");
    }
    if (summary.includes("مطبخ") || summary.includes("أغراض") || summary.includes("kitchen") || summary.includes("amenities")) {
      subjects.push("AMENITIES");
    }
    if (summary.includes("موقع") || summary.includes("location") || summary.includes("واسع") || summary.includes("مساحة")) {
      subjects.push("LOCATION");
    }
    if (summary.includes("غاز") || summary.includes("ماء حار") || summary.includes("gas") || summary.includes("water")) {
      subjects.push("UTILITIES");
    }

    if (subjects.length === 0) {
      subjects.push("OTHER");
    }

    await prisma.campaignCustomer.update({
      where: { id: feedback.id },
      data: { subjects }
    });

    console.log(`Updated ${feedback.id} with subjects:`, subjects);
  }

  console.log("Backfill complete.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
