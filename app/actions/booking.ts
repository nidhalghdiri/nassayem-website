"use server";

import prisma from "@/lib/prisma";
import { differenceInDays, parseISO, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { BookingStatus } from "@prisma/client";
import { encryptSmartPayRequest } from "@/lib/smartpay";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";

const CLEANING_FEE_OMR = 0;
const TAX_RATE = 0;

// Generates a short human-readable booking code like NSM-K4X7Q2 (10 chars)
async function generateBookingCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I to avoid confusion
  let code: string;
  let attempts = 0;
  do {
    code =
      "NSM-" +
      Array.from({ length: 6 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length)),
      ).join("");
    attempts++;
    if (attempts > 20) break; // safety valve
    const exists = await prisma.booking.findUnique({ where: { bookingCode: code } });
    if (!exists) break;
  } while (true);
  return code;
}

/**
 * CORE FUNCTION 1: Overlap Prevention
 */
export async function checkUnitAvailability(
  unitId: string,
  checkInDate: string,
  checkOutDate: string,
) {
  const requestedStart = startOfDay(parseISO(checkInDate));
  const requestedEnd = startOfDay(parseISO(checkOutDate));

  if (requestedStart >= requestedEnd) {
    return { available: false, error: "Check-out date must be after check-in date." };
  }

  const overlappingBookings = await prisma.booking.findMany({
    where: {
      unitId,
      status: { in: ["CONFIRMED", "COMPLETED"] }, // PENDING does not block dates
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
 */
export async function calculateBookingPrice(
  unitId: string,
  checkInDate: string,
  checkOutDate: string,
) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new Error("Unit not found");

  const requestedStart = startOfDay(parseISO(checkInDate));
  const requestedEnd = startOfDay(parseISO(checkOutDate));
  const totalNights = differenceInDays(requestedEnd, requestedStart);
  if (totalNights <= 0) throw new Error("Invalid date range");

  let baseRent = 0;
  let calculationMethod = "";

  if (unit.rentType === "MONTHLY") {
    if (totalNights < 30) throw new Error("This unit requires a minimum stay of 30 nights.");
    const months = totalNights / 30;
    baseRent = (unit.monthlyPrice || 0) * months;
    calculationMethod = `${totalNights} nights (Monthly Rate prorated)`;
  } else if (unit.rentType === "DAILY") {
    baseRent = (unit.dailyPrice || 0) * totalNights;
    calculationMethod = `${totalNights} nights x ${unit.dailyPrice} OMR`;
  } else if (unit.rentType === "BOTH") {
    if (totalNights >= 30 && unit.monthlyPrice) {
      const months = totalNights / 30;
      baseRent = unit.monthlyPrice * months;
      calculationMethod = `${totalNights} nights (Monthly Rate applied)`;
    } else {
      baseRent = (unit.dailyPrice || 0) * totalNights;
      calculationMethod = `${totalNights} nights x ${unit.dailyPrice} OMR`;
    }
  }

  baseRent = Math.round(baseRent * 100) / 100;
  const taxes = Math.round((baseRent + CLEANING_FEE_OMR) * TAX_RATE * 100) / 100;
  const grandTotal = Math.round((baseRent + CLEANING_FEE_OMR + taxes) * 100) / 100;

  return { totalNights, baseRent, cleaningFee: CLEANING_FEE_OMR, taxes, grandTotal, calculationMethod };
}

/**
 * CORE FUNCTION 3: Create Booking
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
  const guestNationality = (formData.get("guestNationality") as string) || null;
  const guestNotes = (formData.get("guestNotes") as string) || null;
  const paymentMethod = (formData.get("paymentMethod") as string) || "CARD";

  if (!guestName || !guestEmail || !guestPhone) {
    throw new Error("Please fill in all contact details.");
  }

  const availability = await checkUnitAvailability(unitId, checkIn, checkOut);
  if (!availability.available) {
    throw new Error("Sorry, these dates are no longer available.");
  }

  const pricing = await calculateBookingPrice(unitId, checkIn, checkOut);
  const bookingCode = await generateBookingCode();

  // Both CASH and CARD start as PENDING.
  // CASH: admin confirms manually after guest pays at reception.
  // CARD: confirmed automatically by the SmartPay webhook.
  const booking = await prisma.booking.create({
    data: {
      bookingCode,
      unitId,
      guestName,
      guestEmail,
      guestPhone,
      guestNationality,
      guestNotes,
      paymentMethod,
      checkIn: startOfDay(parseISO(checkIn)),
      checkOut: startOfDay(parseISO(checkOut)),
      totalPrice: pricing.grandTotal,
      status: "PENDING",
    },
  });

  if (paymentMethod === "CASH") {
    // No payment gateway — send confirmation email immediately
    // Fire-and-forget: don't await so it doesn't block the response
    sendBookingConfirmation(booking.id, locale);
    return { success: true, isCash: true, bookingId: booking.id };
  }

  // CARD: route through SmartPay; booking confirmed only after webhook
  const formattedAmount = Number(pricing.grandTotal).toFixed(3);
  const shortOrderId = Date.now().toString();
  const merchantId = process.env.SMARTPAY_MERCHANT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const redirectUrl = `${baseUrl}/api/payment/smartpay`;
  const cancelUrl = `${baseUrl}/api/payment/smartpay`;

  const requestString = `merchant_id=${merchantId}&order_id=${shortOrderId}&currency=OMR&amount=${formattedAmount}&redirect_url=${redirectUrl}&cancel_url=${cancelUrl}&merchant_param1=${booking.id}&merchant_param2=${locale}`;
  const encRequest = encryptSmartPayRequest(requestString);

  return {
    success: true,
    isCash: false,
    bookingId: booking.id,
    paymentUrl: process.env.SMARTPAY_TRANSACTION_URL,
    accessCode: process.env.SMARTPAY_ACCESS_CODE,
    encRequest,
  };
}

/**
 * CORE FUNCTION 4: Update Booking Status
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
  revalidatePath(`/${locale}/admin/bookings`);
  revalidatePath(`/${locale}/admin`);
}

/**
 * CORE FUNCTION 5: Delete Booking
 */
export async function deleteBooking(bookingId: string, locale: string) {
  await prisma.booking.delete({ where: { id: bookingId } });
  revalidatePath(`/${locale}/admin/bookings`);
  revalidatePath(`/${locale}/admin`);
}
