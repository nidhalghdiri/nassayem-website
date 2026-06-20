// One-off: replace the laundry catalog with the company's own list.
// Each name keeps the Arabic + English words together (no translation); the
// same combined string goes in both nameAr and nameEn so it shows identically
// in either UI language.
// Run with: node prisma/replaceLaundryItems.mjs   (safe to re-run)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_ITEMS = [
  "شرشف كبير Large Bed Sheet",
  "شرشف صغير Small Bed Sheet",
  "كفر لحاف كبير Large Duvet Cover",
  "كفر لحاف صغير Small Duvet Cover",
  "كفر مخدة (غطاء مخدة) Pillowcase / Pillow Cover",
  "لحاف أبيض كبير Large White Duvet / Comforter",
  "لحاف أبيض صغير Small White Duvet / Comforter",
  "لحاف ملون كبير Large Colored Duvet / Comforter",
  "لحاف ملون صغير Small Colored Duvet / Comforter",
  "شرشف كبير ملون Large Colored Bed Sheet",
  "شرشف صغير ملون Small Colored Bed Sheet",
];

async function main() {
  const keep = new Set();

  // 1. Upsert the new items (matched by the combined name in nameEn).
  for (let i = 0; i < NEW_ITEMS.length; i++) {
    const name = NEW_ITEMS[i];
    const existing = await prisma.laundryItemType.findFirst({ where: { nameEn: name } });
    if (existing) {
      await prisma.laundryItemType.update({
        where: { id: existing.id },
        data: { nameAr: name, nameEn: name, displayOrder: i, isActive: true },
      });
      keep.add(existing.id);
    } else {
      const created = await prisma.laundryItemType.create({
        data: { nameEn: name, nameAr: name, displayOrder: i, isActive: true },
      });
      keep.add(created.id);
    }
  }

  // 2. Old items not in the new list: delete if unused, retire if referenced.
  const all = await prisma.laundryItemType.findMany({
    include: { _count: { select: { orderItems: true } } },
  });
  let deleted = 0;
  let retired = 0;
  for (const item of all) {
    if (keep.has(item.id)) continue;
    if (item._count.orderItems === 0) {
      await prisma.laundryItemType.delete({ where: { id: item.id } });
      deleted++;
    } else {
      await prisma.laundryItemType.update({ where: { id: item.id }, data: { isActive: false } });
      retired++;
    }
  }

  console.log(
    `Catalog updated — ${keep.size} active item(s), ${deleted} old deleted, ${retired} old retired (still referenced by orders).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
