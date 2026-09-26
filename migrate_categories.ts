import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check if "Khareef 2026" exists
  let khareefCategory = await prisma.customerCategory.findUnique({
    where: { name: "Khareef 2026" }
  });

  if (!khareefCategory) {
    khareefCategory = await prisma.customerCategory.create({
      data: {
        name: "Khareef 2026",
        whatsappTemplateId: "feedback_campaign", // Using a placeholder for now, maybe we can fetch the actual one or prompt user
      }
    });
    console.log("Created category Khareef 2026");
  }

  const result = await prisma.campaignCustomer.updateMany({
    where: { categoryId: null },
    data: { categoryId: khareefCategory.id }
  });
  console.log(`Updated ${result.count} customers to Khareef 2026`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
