import { PrismaClient, EquipmentStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const STATUS_MAP: Record<string, EquipmentStatus> = {
  "جيد": "GOOD",
  "متوسط": "FAIR",
  "يحتاج صيانة": "NEEDS_REPAIR",
  "يحتاج استبدال": "NEEDS_REPLACEMENT",
  "معطل": "BROKEN",
};

async function main() {
  const csvPath = path.join(__dirname, '../equipements.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const typesSet = new Set<string>();
  
  // First pass: extract all unique types
  for (const line of dataLines) {
    const cols = line.split(',');
    const typeAr = cols[3]?.trim();
    if (typeAr) {
      typesSet.add(typeAr);
    }
  }
  
  console.log(`Found ${typesSet.size} unique equipment types. Inserting...`);
  
  const typeMap = new Map<string, string>();
  for (const typeAr of Array.from(typesSet)) {
    let eqType = await prisma.equipmentType.findFirst({
      where: { nameAr: typeAr }
    });
    if (!eqType) {
      eqType = await prisma.equipmentType.create({
        data: { nameAr: typeAr }
      });
    }
    typeMap.set(typeAr, eqType.id);
  }
  
  console.log(`Types inserted. Now inserting equipment data...`);
  
  let inserted = 0;
  for (const line of dataLines) {
    const cols = line.split(',');
    const qrCode = cols[0]?.trim();
    const buildingId = cols[1]?.trim();
    const unitNumber = cols[2]?.trim() || null;
    const typeAr = cols[3]?.trim();
    const brandModel = cols[4]?.trim() || null;
    const rawStatus = cols[5]?.trim();
    
    if (!qrCode || !buildingId || !typeAr) {
      continue; // Skip invalid lines
    }
    
    const status = STATUS_MAP[rawStatus] || "GOOD";
    const typeId = typeMap.get(typeAr)!;
    
    try {
      await prisma.equipment.upsert({
        where: { qrCode },
        update: {
          buildingId,
          unitNumber,
          typeId,
          brandModel,
          status
        },
        create: {
          qrCode,
          buildingId,
          unitNumber,
          typeId,
          brandModel,
          status
        }
      });
      inserted++;
    } catch (e) {
      console.error(`Error inserting ${qrCode}:`, e);
    }
  }
  
  console.log(`Successfully imported ${inserted} equipments!`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
