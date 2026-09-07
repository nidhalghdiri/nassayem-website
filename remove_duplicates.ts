import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.campaignCustomer.findMany();
  
  const phoneMap = new Map<string, typeof customers[0][]>();
  
  for (const c of customers) {
    // Normalize phone number slightly if needed, but assuming exact match is fine.
    const phone = c.phone.trim();
    if (!phoneMap.has(phone)) {
      phoneMap.set(phone, []);
    }
    phoneMap.get(phone)!.push(c);
  }
  
  let duplicateGroups = 0;
  let toDeleteIds: string[] = [];
  
  for (const [phone, group] of phoneMap.entries()) {
    if (group.length > 1) {
      duplicateGroups++;
      
      // Sort the group to prioritize keeping records that are NOT PENDING
      group.sort((a, b) => {
        if (a.status !== 'PENDING' && b.status === 'PENDING') return -1;
        if (b.status !== 'PENDING' && a.status === 'PENDING') return 1;
        // fallback to keeping the one with newest checkoutDate
        if (a.checkoutDate && b.checkoutDate) {
           return b.checkoutDate.getTime() - a.checkoutDate.getTime();
        }
        if (a.checkoutDate && !b.checkoutDate) return -1;
        if (b.checkoutDate && !a.checkoutDate) return 1;
        return 0;
      });
      
      // Keep the first one, delete the rest
      const keep = group[0];
      const deleteList = group.slice(1);
      
      for (const d of deleteList) {
        toDeleteIds.push(d.id);
      }
    }
  }
  
  console.log(`Total customers scanned: ${customers.length}`);
  console.log(`Found ${duplicateGroups} phone numbers with duplicates.`);
  console.log(`Total duplicate records to delete: ${toDeleteIds.length}`);
  
  if (toDeleteIds.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < toDeleteIds.length; i += chunkSize) {
      const chunk = toDeleteIds.slice(i, i + chunkSize);
      await prisma.campaignCustomer.deleteMany({
        where: {
          id: { in: chunk }
        }
      });
    }
    console.log('Duplicates removed successfully.');
  } else {
    console.log('No duplicates found.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
