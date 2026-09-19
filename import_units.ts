import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function importUnits() {
  const csvPath = path.join(__dirname, 'units.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',');
  
  let successCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // We split by comma but since locations have commas... wait, the user's data does not seem to have commas in the Location column. 
    // Let's check: "building_id,netsuite_id,unit_name,Location,unit_type"
    // "1c54f2e1-78c9-4552-8125-5da8fca6ff1a,6841,WD-404,الادارة العامة نسائم صلالة : بناية الوادي - 20,TWO_BEDROOM"
    // Yes, 5 columns separated by commas.
    const columns = line.split(',');
    
    if (columns.length < 5) {
      console.log(`Skipping invalid line ${i + 1}: ${line}`);
      continue;
    }
    
    const buildingId = columns[0].trim();
    const netsuiteId = columns[1].trim();
    const unitName = columns[2].trim();
    const location = columns[3].trim(); // Not needed for DB, just for reference
    const unitType = columns[4].trim() as any;

    try {
      await prisma.buildingUnit.create({
        data: {
          buildingId,
          netsuiteId,
          name: unitName,
          type: unitType,
        },
      });
      successCount++;
    } catch (e: any) {
      console.error(`Failed to import unit ${unitName} (${netsuiteId}):`, e.message);
      errorCount++;
    }
  }

  console.log(`\nImport complete!`);
  console.log(`Successfully imported: ${successCount} units`);
  console.log(`Failed to import: ${errorCount} units`);
}

importUnits()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
