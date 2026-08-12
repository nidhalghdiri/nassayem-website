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

    // Map CSV rows to Prisma CampaignCustomer
    // Assuming CSV columns: netsuiteCustomerId, name, phone, reservationNumber, building, unitType, unitNumber, checkinDate, checkoutDate, stayAmount, nightRate
    const campaignCustomers = data.map((row: any) => ({
      campaignId: 'KHAREEF_2026',
      netsuiteCustomerId: row.netsuiteCustomerId || null,
      name: row.name || 'Unknown',
      phone: row.phone ? String(row.phone).trim() : '',
      reservationNumber: row.reservationNumber || null,
      building: row.building || null,
      unitType: row.unitType || null,
      unitNumber: row.unitNumber || null,
      checkinDate: row.checkinDate ? new Date(row.checkinDate) : null,
      checkoutDate: row.checkoutDate ? new Date(row.checkoutDate) : null,
      stayAmount: row.stayAmount ? parseFloat(row.stayAmount) : null,
      nightRate: row.nightRate ? parseFloat(row.nightRate) : null,
      status: 'PENDING' as const, // Uses Prisma CampaignCustomerStatus Enum
    })).filter((c: any) => c.phone !== ''); // Require a phone number for the WhatsApp campaign

    if (campaignCustomers.length === 0) {
      return NextResponse.json({ error: 'No valid rows with phone numbers found in CSV' }, { status: 400 });
    }

    const result = await prisma.campaignCustomer.createMany({
      data: campaignCustomers,
      // skipDuplicates: true requires a unique constraint, but we only have ID as unique. 
      // If we want to prevent duplicates, we might need to check existing by phone + campaignId.
      // For now, we just insert.
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Campaign CSV import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
