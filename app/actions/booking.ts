"use server";

import prisma from "@/lib/prisma";
import { differenceInDays, parseISO, startOfDay } from "date-fns"; // We'll need this package for safe date math
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { encryptSmartPayRequest } from "@/lib/smartpay";

// Define our standard fees (In a full SaaS, these might live in the database per-building)
const CLEANING_FEE_OMR = 0;
const TAX_RATE = 0; // 5% VAT or Tourism Tax

/**
 * CORE FUNCTION 1: Overlap Prevention
 * Checks if a unit is free for the requested dates.
 */
export async function checkUnitAvailability(
  unitId: string,
  checkInDate: string,
  checkOutDate: string,
) {
  const requestedStart = startOfDay(parseISO(checkInDate));
  const requestedEnd = startOfDay(parseISO(checkOutDate));

  if (requestedStart >= requestedEnd) {
    return {
      available: false,
      error: "Check-out date must be after check-in date.",
    };
  }

  // The strict overlap query:
  // A booking overlaps if it starts BEFORE the requested check-out
  // AND ends AFTER the requested check-in.
  const overlappingBookings = await prisma.booking.findMany({
    where: {
      unitId: unitId,
      status: {
        not: "CANCELLED", // We only care about PENDING, CONFIRMED, or COMPLETED
      },
      AND: [
        { checkIn: { lt: requestedEnd } },
        { checkOut: { gt: requestedStart } },
      ],
    },
  });

  if (overlappingBookings.length > 0) {
    return { available: false, error: "These dates are already booked." };
  }

  return { available: true };
}

/**
 * CORE FUNCTION 2: Dynamic Pricing Engine
 * Calculates the exact breakdown of costs based on the unit's rent type.
 */
export async function calculateBookingPrice(
  unitId: string,
  checkInDate: string,
  checkOutDate: string,
) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });

  if (!unit) {
    throw new Error("Unit not found");
  }

  const requestedStart = startOfDay(parseISO(checkInDate));
  const requestedEnd = startOfDay(parseISO(checkOutDate));
  const totalNights = differenceInDays(requestedEnd, requestedStart);

  if (totalNights <= 0) throw new Error("Invalid date range");

  let baseRent = 0;
  let calculationMethod = "";

  // Logic for Monthly Rent
  if (unit.rentType === "MONTHLY") {
    if (totalNights < 30) {
      throw new Error("This unit requires a minimum stay of 30 nights.");
    }
    // Calculate prorated monthly cost (e.g., 45 days = 1.5 months)
    const months = totalNights / 30;
    baseRent = (unit.monthlyPrice || 0) * months;
    calculationMethod = `${totalNights} nights (Monthly Rate prorated)`;
  }

  // Logic for Daily Rent
  else if (unit.rentType === "DAILY") {
    baseRent = (unit.dailyPrice || 0) * totalNights;
    calculationMethod = `${totalNights} nights x ${unit.dailyPrice} OMR`;
  }

  // Logic for "BOTH" (Hybrid pricing - e.g., daily rate for < 30 days, monthly rate for >= 30 days)
  else if (unit.rentType === "BOTH") {
    if (totalNights >= 30 && unit.monthlyPrice) {
      const months = totalNights / 30;
      baseRent = unit.monthlyPrice * months;
      calculationMethod = `${totalNights} nights (Monthly Rate applied)`;
    } else {
      baseRent = (unit.dailyPrice || 0) * totalNights;
      calculationMethod = `${totalNights} nights x ${unit.dailyPrice} OMR`;
    }
  }

  // Round base rent to 2 decimal places
  baseRent = Math.round(baseRent * 100) / 100;

  const taxes =
    Math.round((baseRent + CLEANING_FEE_OMR) * TAX_RATE * 100) / 100;
  const grandTotal =
    Math.round((baseRent + CLEANING_FEE_OMR + taxes) * 100) / 100;

  return {
    totalNights,
    baseRent,
    cleaningFee: CLEANING_FEE_OMR,
    taxes,
    grandTotal,
    calculationMethod,
  };
}

/**
 * CORE FUNCTION 3: Create Booking
 * Securely re-verifies data and creates the reservation.
 */
export async function createBooking(
  formData: FormData,
  unitId: string,
  checkIn: string,
  checkOut: string,
  locale: string,
) {
  const guestName = formData.get("guestName") as string;
  const guestEmail = formData.get("guestEmail") as string;
  const guestPhone = formData.get("guestPhone") as string;

  if (!guestName || !guestEmail || !guestPhone) {
    throw new Error("Please fill in all contact details.");
  }

  // 1. Re-verify availability (Server-side authority)
  const availability = await checkUnitAvailability(unitId, checkIn, checkOut);
  if (!availability.available) {
    throw new Error("Sorry, these dates are no longer available.");
  }

  // 2. Re-calculate price (Server-side authority)
  const pricing = await calculateBookingPrice(unitId, checkIn, checkOut);

  // 3. Create the Booking record in Prisma
  const booking = await prisma.booking.create({
    data: {
      unitId,
      guestName,
      guestEmail,
      guestPhone,
      checkIn: startOfDay(parseISO(checkIn)),
      checkOut: startOfDay(parseISO(checkOut)),
      totalPrice: pricing.grandTotal,
      status: "PENDING", // Defaults to PENDING until payment is confirmed in Stage 3.3
    },
  });
  // Done

  // 4. Format Amount for OMR (Must be 3 decimal places, e.g., 120.000)
  const formattedAmount = Number(pricing.grandTotal).toFixed(3);

  const shortOrderId = Date.now().toString();

  // 4. Prepare URLs
  const merchantId = process.env.SMARTPAY_MERCHANT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const redirectUrl = `${baseUrl}/api/payment/smartpay`;
  const cancelUrl = `${baseUrl}/api/payment/smartpay`;

  // 5. Form the exact request string mandated by Bank Muscat
  const requestString = `merchant_id=${merchantId}&order_id=${shortOrderId}&currency=OMR&amount=${formattedAmount}&redirect_url=${redirectUrl}&cancel_url=${cancelUrl}&merchant_param1=${booking.id}&merchant_param2=${locale}`;
  const encRequest = encryptSmartPayRequest(requestString);

  return {
    success: true,
    paymentUrl: process.env.SMARTPAY_TRANSACTION_URL,
    accessCode: process.env.SMARTPAY_ACCESS_CODE,
    encRequest: encRequest,
  };
}
/**
 * CORE FUNCTION 4: Update Booking Status
 * Allows admins to transition bookings (e.g., PENDING -> CONFIRMED)
 */
export async function updateBookingStatus(
  bookingId: string,
  newStatus: BookingStatus,
  locale: string,
) {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: newStatus },
  });

  // Refresh both the bookings table and the dashboard stats
  revalidatePath(`/${locale}/admin/bookings`);
  revalidatePath(`/${locale}/admin`);
}
