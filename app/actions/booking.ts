"use server";

import prisma from "@/lib/prisma";
import { differenceInDays, parseISO, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { BookingStatus } from "@prisma/client";
import { encryptSmartPayRequest } from "@/lib/smartpay";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";
import { getActivePromotionForUnit } from "@/app/actions/promotion";
import { getPeriodPricing } from "@/app/actions/pricing";
import { KHAREEF_NO_PROMO_ERROR } from "@/lib/bookingErrors";

const CLEANING_FEE_OMR = 0;
const TAX_RATE = 0;

// Advance-payment policy: bookings with a total above this threshold may pay
// 50% online + 50% at reception. Below or equal, full amount is required.
const ADVANCE_PAYMENT_MIN_TOTAL_OMR = 30;
const ADVANCE_PAYMENT_RATIO = 0.5;

// Returns true when any night in [start, end) falls in July (6) or August (7).
// `end` is the morning of departure, so it is exclusive.
function rangeContainsKhareef(start: Date, end: Date): boolean {
  const cursor = new Date(start);
  while (cursor < end) {
    const m = cursor.getMonth();
    if (m === 6 || m === 7) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

// "2026-07-05" → "2026-07-04". TZ-safe (UTC date math only).
function subtractOneDayISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

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
 * CORE FUNCTION 1: Inventory-aware availability check.
 *
 * A unit represents a pool of `inventoryCount` identical rooms. We block the
 * dates only when the number of overlapping CONFIRMED/COMPLETED bookings has
 * already reached the inventory pool. PENDING bookings never block.
 *
 * Returns `remaining` so the UI can render urgency badges ("Only 1 left").
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

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { inventoryCount: true },
  });
  if (!unit) return { available: false, error: "Unit not found." };

  const overlappingCount = await prisma.booking.count({
    where: {
      unitId,
      status: { in: ["CONFIRMED", "COMPLETED"] }, // PENDING does not block dates
      AND: [
        { checkIn: { lt: requestedEnd } },
        { checkOut: { gt: requestedStart } },
      ],
    },
  });

  const remaining = Math.max(0, unit.inventoryCount - overlappingCount);

  if (remaining <= 0) {
    return { available: false, remaining: 0, error: "These dates are already booked." };
  }
  return { available: true, remaining };
}

/**
 * CORE FUNCTION 2: Dynamic Pricing Engine
 *
 * Applies a promotion only to daily rentals — monthly bookings keep the unit's
 * normal monthlyPrice. When a promotion matches, baseRent uses the promo price
 * and the response includes a `promotion` block so the UI can show the
 * struck-through original alongside the new price.
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
  let promotion: {
    promotionId: string;
    titleEn: string;
    titleAr: string;
    regularPrice: number;
    promoPrice: number;
    originalBaseRent: number;
    savings: number;
  } | null = null;

  // Daily-mode pricing — checked first because BOTH may resolve to daily.
  const usingDaily =
    unit.rentType === "DAILY" ||
    (unit.rentType === "BOTH" && (totalNights < 30 || !unit.monthlyPrice));

  // Fetch promo + per-day pricing-module data in parallel (daily-style only).
  // The pricing module is the inclusive [first-night, last-night] window —
  // checkOut morning is not a stay night, so we subtract one day.
  const lastNightISO = subtractOneDayISO(checkOutDate);
  const [activePromo, modulePricing] = usingDaily
    ? await Promise.all([
        getActivePromotionForUnit(unitId, checkInDate, checkOutDate),
        getPeriodPricing({
          buildingId: unit.buildingId,
          unitType: unit.unitType,
          unitId: unit.id,
          startDate: checkInDate,
          endDate: lastNightISO,
        }),
      ])
    : [null, null];

  const moduleAllPriced =
    modulePricing !== null &&
    modulePricing.totals.unpricedNights === 0 &&
    modulePricing.totals.pricedNights > 0;

  // Khareef gate: refuse any booking touching July/August unless EITHER
  //   (a) an active promotion covers the dates, OR
  //   (b) the pricing module has a price for every stay night.
  // Server-side check — the client can't bypass it.
  if (
    rangeContainsKhareef(requestedStart, requestedEnd) &&
    !activePromo &&
    !moduleAllPriced
  ) {
    throw new Error(KHAREEF_NO_PROMO_ERROR);
  }

  if (unit.rentType === "MONTHLY") {
    if (totalNights < 30) throw new Error("This unit requires a minimum stay of 30 nights.");
    const months = totalNights / 30;
    baseRent = (unit.monthlyPrice || 0) * months;
    calculationMethod = `${totalNights} nights (Monthly Rate prorated)`;
  } else if (usingDaily) {
    // Pricing priority: active promotion > pricing module > unit.dailyPrice.
    if (activePromo) {
      const originalDaily = unit.dailyPrice ?? activePromo.regularPrice;
      const originalBaseRent =
        Math.round(originalDaily * totalNights * 100) / 100;
      baseRent = activePromo.promoPrice * totalNights;
      calculationMethod = `${totalNights} nights x ${activePromo.promoPrice} OMR (promo)`;
      promotion = {
        promotionId: activePromo.promotionId,
        titleEn: activePromo.titleEn,
        titleAr: activePromo.titleAr,
        regularPrice: activePromo.regularPrice,
        promoPrice: activePromo.promoPrice,
        originalBaseRent,
        savings: Math.round((originalBaseRent - baseRent) * 100) / 100,
      };
    } else if (moduleAllPriced) {
      // Sum the per-night effective prices (override > base, resolved by SQL).
      baseRent = modulePricing!.totals.total ?? 0;
      calculationMethod = `${totalNights} nights (per-day pricing)`;
    } else {
      baseRent = (unit.dailyPrice || 0) * totalNights;
      calculationMethod = `${totalNights} nights x ${unit.dailyPrice} OMR`;
    }
  } else {
    // BOTH with monthly threshold met
    const months = totalNights / 30;
    baseRent = (unit.monthlyPrice || 0) * months;
    calculationMethod = `${totalNights} nights (Monthly Rate applied)`;
  }

  baseRent = Math.round(baseRent * 100) / 100;
  const taxes = Math.round((baseRent + CLEANING_FEE_OMR) * TAX_RATE * 100) / 100;
  const grandTotal = Math.round((baseRent + CLEANING_FEE_OMR + taxes) * 100) / 100;

  return {
    totalNights,
    baseRent,
    cleaningFee: CLEANING_FEE_OMR,
    taxes,
    grandTotal,
    calculationMethod,
    promotion,
  };
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
  const rawPaymentPlan = (formData.get("paymentPlan") as string) || "FULL";

  if (!guestName || !guestEmail || !guestPhone) {
    throw new Error("Please fill in all contact details.");
  }

  // Khareef stays (any night in July/August) must be paid online.
  if (
    paymentMethod === "CASH" &&
    rangeContainsKhareef(
      startOfDay(parseISO(checkIn)),
      startOfDay(parseISO(checkOut)),
    )
  ) {
    throw new Error(
      locale === "ar"
        ? "خلال موسم الخريف (يوليو–أغسطس)، الدفع الإلكتروني مطلوب."
        : "Online payment is required during Khareef season (July–August).",
    );
  }

  const pricing = await calculateBookingPrice(unitId, checkIn, checkOut);
  const bookingCode = await generateBookingCode();

  // Resolve the effective payment plan + amounts. The server is the source of
  // truth here — a tampered client payload cannot get advance pricing on a
  // small booking or outside Khareef season.
  // Advance-payment is offered only for Khareef CARD bookings strictly above
  // ADVANCE_PAYMENT_MIN_TOTAL_OMR (30 OMR by default).
  const stayIsKhareef = rangeContainsKhareef(
    startOfDay(parseISO(checkIn)),
    startOfDay(parseISO(checkOut)),
  );
  const advanceEligible =
    paymentMethod === "CARD" &&
    stayIsKhareef &&
    pricing.grandTotal > ADVANCE_PAYMENT_MIN_TOTAL_OMR;
  const paymentPlan =
    rawPaymentPlan === "ADVANCE_50" && advanceEligible ? "ADVANCE_50" : "FULL";

  // What SmartPay will actually charge today, and what reception must collect.
  const chargeNowRaw =
    paymentPlan === "ADVANCE_50"
      ? pricing.grandTotal * ADVANCE_PAYMENT_RATIO
      : pricing.grandTotal;
  const chargeNow = Math.round(chargeNowRaw * 1000) / 1000;
  const dueAtCheckIn =
    Math.round((pricing.grandTotal - chargeNow) * 1000) / 1000;

  const startDate = startOfDay(parseISO(checkIn));
  const endDate = startOfDay(parseISO(checkOut));

  // Serializable transaction: re-count CONFIRMED/COMPLETED overlapping
  // bookings against the unit's inventory pool right before insert. If two
  // requests race for the last room, one transaction will be aborted by
  // Postgres and we surface a clean "no longer available" error.
  // Both CASH and CARD start as PENDING; PENDING does not consume inventory.
  let booking;
  try {
    booking = await prisma.$transaction(
      async (tx) => {
        const unit = await tx.unit.findUnique({
          where: { id: unitId },
          select: { inventoryCount: true },
        });
        if (!unit) throw new Error("Unit not found.");

        const overlappingCount = await tx.booking.count({
          where: {
            unitId,
            status: { in: ["CONFIRMED", "COMPLETED"] },
            AND: [
              { checkIn: { lt: endDate } },
              { checkOut: { gt: startDate } },
            ],
          },
        });

        if (overlappingCount >= unit.inventoryCount) {
          throw new Error("Sorry, these dates are no longer available.");
        }

        return tx.booking.create({
          data: {
            bookingCode,
            unitId,
            guestName,
            guestEmail,
            guestPhone,
            guestNationality,
            guestNotes,
            paymentMethod,
            paymentPlan,
            amountDueAtCheckIn: dueAtCheckIn,
            // amountPaid: set by SmartPay webhook (CARD) or admin (CASH).
            checkIn: startDate,
            checkOut: endDate,
            totalPrice: pricing.grandTotal,
            status: "PENDING",
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err: any) {
    // Postgres raises 40001 (serialization_failure) when it aborts a
    // serializable txn — translate that to the same user-facing message.
    if (err?.code === "P2034" || /serialization/i.test(err?.message ?? "")) {
      throw new Error("Sorry, these dates are no longer available.");
    }
    throw err;
  }

  if (paymentMethod === "CASH") {
    // No payment gateway — send confirmation email immediately
    // Fire-and-forget: don't await so it doesn't block the response
    sendBookingConfirmation(booking.id, locale);
    return { success: true, isCash: true, bookingId: booking.id };
  }

  // CARD: route through SmartPay; booking confirmed only after webhook.
  // The amount sent to SmartPay is what we charge today — full or 50% advance.
  const formattedAmount = Number(chargeNow).toFixed(3);
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
