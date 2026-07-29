import { PrismaClient, Prisma } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('Loading backup data to calculate updates...')
  
  const backupFile = fs.readFileSync('prices_backup.json', 'utf8')
  const backupData = JSON.parse(backupFile)
  
  const unitTypeDailyPrices = backupData.unitTypeDailyPrices
  const unitDailyPriceOverrides = backupData.unitDailyPriceOverrides
  
  const multiplyPrice = (price: any) => {
    if (price === null || price === undefined) return null;
    const numPrice = typeof price === 'number' ? price : Number(price);
    return Number((numPrice * 1.05).toFixed(2));
  }
  
  console.log('Starting price updates in batches...')
  
  // Update UnitTypeDailyPrice in batches of 50
  const batchSize = 50;
  let successCount = 0;
  
  for (let i = 0; i < unitTypeDailyPrices.length; i += batchSize) {
    const batch = unitTypeDailyPrices.slice(i, i + batchSize);
    
    await Promise.all(batch.map((utdp: any) => 
      prisma.unitTypeDailyPrice.update({
        where: { id: utdp.id },
        data: {
          dailyPrice: new Prisma.Decimal(multiplyPrice(utdp.dailyPrice) as number)
        }
      })
    ));
    
    successCount += batch.length;
    console.log(`Updated ${successCount}/${unitTypeDailyPrices.length} daily prices...`);
  }
  
  // Update UnitDailyPriceOverride
  let overrideCount = 0;
  for (let i = 0; i < unitDailyPriceOverrides.length; i += batchSize) {
    const batch = unitDailyPriceOverrides.slice(i, i + batchSize);
    
    await Promise.all(batch.map((override: any) => 
      prisma.unitDailyPriceOverride.update({
        where: { id: override.id },
        data: {
          dailyPrice: new Prisma.Decimal(multiplyPrice(override.dailyPrice) as number)
        }
      })
    ));
    
    overrideCount += batch.length;
    console.log(`Updated ${overrideCount}/${unitDailyPriceOverrides.length} overrides...`);
  }
  
  console.log('All prices updated successfully.');
}

main()
  .catch(e => {
    console.error('Error during update:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
