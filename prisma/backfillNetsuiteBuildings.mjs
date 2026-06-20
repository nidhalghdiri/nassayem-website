// One-off backfill: link old NetsuitePayment records (created before the
// Building↔NetSuite mapping existed) to a website Building, keyed by the
// receptionist email that handled them. Each email maps to one building.
//
// Only touches records with buildingId = null, so it's idempotent and never
// overwrites an already-resolved link. Sets both buildingId and
// netsuiteBuildingId (from the matched building) for consistency.
//
// Run with: node prisma/backfillNetsuiteBuildings.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// receptionist email → building NetSuite id (Building.netsuiteId)
const EMAIL_TO_NETSUITE_ID = {
  "aloudi.netsuite@gmail.com": "110", // Al Wadi Building
  "mohamed.hamed.netsuite@gmail.com": "112", // Salalah Center
  "saada25.netsuite@gmail.com": "104", // Saada 25 Building
  "gholshan.netsuite@gmail.com": "77", // Downtown
  "bdalslamhfzaldyn@gmail.com": "215", // Al-hasilah
  "abdqader.netsuite@gmail.com": "106", // Saada nesto
  "basel.netsuite@gmail.com": "105", // Awqad Building
};

async function main() {
  let totalUpdated = 0;

  for (const [email, netsuiteId] of Object.entries(EMAIL_TO_NETSUITE_ID)) {
    const building = await prisma.building.findUnique({
      where: { netsuiteId },
      select: { id: true, nameEn: true },
    });
    if (!building) {
      console.warn(`⚠ No building with netsuiteId=${netsuiteId} for ${email} — skipped.`);
      continue;
    }

    const res = await prisma.netsuitePayment.updateMany({
      where: {
        buildingId: null,
        receptionistEmail: { equals: email, mode: "insensitive" },
      },
      data: { buildingId: building.id, netsuiteBuildingId: netsuiteId },
    });
    totalUpdated += res.count;
    console.log(`  ${String(res.count).padStart(3)} → ${building.nameEn}  (${email})`);
  }

  const remaining = await prisma.netsuitePayment.count({ where: { buildingId: null } });
  console.log(`\nLinked ${totalUpdated} record(s). Still unlinked: ${remaining}.`);

  if (remaining > 0) {
    const rows = await prisma.netsuitePayment.groupBy({
      by: ["receptionistEmail"],
      where: { buildingId: null },
      _count: { _all: true },
    });
    console.log("Unmapped receptionist emails still needing a building:");
    for (const r of rows) console.log(`  ${r._count._all}×  ${r.receptionistEmail ?? "(null)"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
