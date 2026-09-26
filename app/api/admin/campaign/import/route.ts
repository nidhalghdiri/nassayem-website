import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const { data, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (errors.length > 0) {
      console.error("CSV Parse Errors:", errors);
      return NextResponse.json({ error: 'Error parsing CSV file', details: errors }, { status: 400 });
    }

    // Fetch existing categories and buildings for mapping
    const existingCategories = await prisma.customerCategory.findMany();
    const categoryMap = new Map<string, string>();
    for (const c of existingCategories) {
      categoryMap.set(c.name.toLowerCase().trim(), c.id);
    }

    const existingBuildings = await prisma.building.findMany();
    const buildingMap = new Map<string, string>();
    for (const b of existingBuildings) {
      buildingMap.set(b.id, b.shortName || b.nameAr || b.nameEn);
    }

    // Process rows
    const campaignCustomers = [];
    for (const rawRow of data) {
      const row = rawRow as any;
      if (!row.phone) continue;

      const categoryName = (row.categoryName || row.category || "").trim();
      if (!categoryName) {
        continue; // Skip if no category name
      }

      let categoryId = categoryMap.get(categoryName.toLowerCase());
      if (!categoryId) {
        // Create it on the fly if it doesn't exist
        const newCat = await prisma.customerCategory.create({
          data: { name: categoryName, whatsappTemplateId: null }
        });
        categoryId = newCat.id;
        categoryMap.set(categoryName.toLowerCase(), categoryId);
      }

      const buildingId = row.building || row.buildingId || "";
      const mappedBuildingName = buildingMap.get(buildingId) || buildingId || null;

      campaignCustomers.push({
        campaignId: 'KHAREEF_2026',
        categoryId,
        netsuiteCustomerId: row.netsuiteCustomerId || null,
        name: row.name || 'Unknown',
        phone: String(row.phone).trim(),
        reservationNumber: row.reservationNumber || null,
        building: mappedBuildingName,
        unitType: row.unitType || null,
        unitNumber: row.unitNumber || null,
        checkinDate: row.checkinDate ? new Date(row.checkinDate) : null,
        checkoutDate: row.checkoutDate ? new Date(row.checkoutDate) : null,
        stayAmount: row.stayAmount ? parseFloat(row.stayAmount) : null,
        nightRate: row.nightRate ? parseFloat(row.nightRate) : null,
        status: 'PENDING' as const, 
      });
    }

    if (campaignCustomers.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Ensure phone and categoryName are provided.' }, { status: 400 });
    }

    const result = await prisma.campaignCustomer.createMany({
      data: campaignCustomers,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Campaign CSV import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
