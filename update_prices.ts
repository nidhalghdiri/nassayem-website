import { PrismaClient, Prisma } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('Fetching current prices for backup...')
  
  // 1. Fetch data
  const units = await prisma.unit.findMany()
  const unitTypeDailyPrices = await prisma.unitTypeDailyPrice.findMany()
  const unitDailyPriceOverrides = await prisma.unitDailyPriceOverride.findMany()
  
  // 2. Backup
  const backupData = {
    timestamp: new Date().toISOString(),
    units,
    unitTypeDailyPrices,
    unitDailyPriceOverrides
  }
  
  fs.writeFileSync('prices_backup.json', JSON.stringify(backupData, null, 2))
  console.log(`Backup saved to prices_backup.json with ${units.length} units, ${unitTypeDailyPrices.length} type daily prices, and ${unitDailyPriceOverrides.length} overrides.`)
  
  // 3. Update Function
  // Multiply by 1.05, keeping it to 2 decimal places to avoid float precision issues
  const multiplyPrice = (price: any) => {
    if (price === null || price === undefined) return null;
    const numPrice = typeof price === 'number' ? price : Number(price);
    return Number((numPrice * 1.05).toFixed(2));
  }
  
  console.log('Starting price updates (5% increase)...')
  
  // Update Units
  let unitsUpdated = 0;
  for (const unit of units) {
    if (unit.dailyPrice !== null || unit.monthlyPrice !== null) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          dailyPrice: multiplyPrice(unit.dailyPrice),
          monthlyPrice: multiplyPrice(unit.monthlyPrice)
        }
      })
      unitsUpdated++;
    }
  }
  console.log(`Updated ${unitsUpdated} units.`);
  
  // Update UnitTypeDailyPrice
  for (const utdp of unitTypeDailyPrices) {
    await prisma.unitTypeDailyPrice.update({
      where: { id: utdp.id },
      data: {
        dailyPrice: new Prisma.Decimal(multiplyPrice(utdp.dailyPrice) as number)
      }
    })
  }
  console.log(`Updated ${unitTypeDailyPrices.length} UnitTypeDailyPrice records.`);
  
  // Update UnitDailyPriceOverride
  for (const override of unitDailyPriceOverrides) {
    await prisma.unitDailyPriceOverride.update({
      where: { id: override.id },
      data: {
        dailyPrice: new Prisma.Decimal(multiplyPrice(override.dailyPrice) as number)
      }
    })
  }
  console.log(`Updated ${unitDailyPriceOverrides.length} UnitDailyPriceOverride records.`);
  
  console.log('All prices increased by 5% successfully.');
}

main()
  .catch(e => {
    console.error('Error during update:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
