// One-off idempotent seed for the laundry item catalog.
// Run with: node prisma/seedLaundryItems.mjs
// Safe to re-run — existing items (matched by nameEn) are skipped.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_ITEMS = [
  { nameEn: "Bed Sheet", nameAr: "ملاءة سرير" },
  { nameEn: "Pillow Case", nameAr: "كيس وسادة" },
  { nameEn: "Pillow", nameAr: "وسادة" },
  { nameEn: "Blanket", nameAr: "بطانية" },
  { nameEn: "Duvet", nameAr: "لحاف" },
  { nameEn: "Carpet", nameAr: "سجادة" },
  { nameEn: "Towel", nameAr: "منشفة" },
  { nameEn: "Bath Mat", nameAr: "سجادة حمام" },
  { nameEn: "Curtain", nameAr: "ستارة" },
  { nameEn: "Table Cloth", nameAr: "مفرش طاولة" },
];

async function main() {
  let created = 0;
  for (let i = 0; i < DEFAULT_ITEMS.length; i++) {
    const item = DEFAULT_ITEMS[i];
    const existing = await prisma.laundryItemType.findFirst({
      where: { nameEn: item.nameEn },
    });
    if (existing) continue;
    await prisma.laundryItemType.create({
      data: { ...item, displayOrder: i, isActive: true },
    });
    created++;
  }
  console.log(`Laundry item catalog seeded. Created ${created} new item(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
