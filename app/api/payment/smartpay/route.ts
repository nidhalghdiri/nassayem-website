import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptSmartPayResponse } from "@/lib/smartpay";

export async function POST(req: NextRequest) {
  // Get the locale from the query parameter we passed in the redirect_url
  const locale = req.nextUrl.searchParams.get("locale") || "en";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  try {
    // 1. Safely parse the raw text body (Bank gateways send x-www-form-urlencoded)
    const textBody = await req.text();
    console.log("RAW BANK RESPONSE:", textBody);

    // Read the form data sent by the bank
    const formData = await req.formData();
    const orderId = formData.get("order_id") as string; // [cite: 117]
    const encResponse = formData.get("encResponse") as string; // [cite: 118]

    if (!encResponse) {
      console.error("ERROR: No encrypted response received from bank.");
      return NextResponse.redirect(`${baseUrl}/en/checkout/error`);
    }

    // 1. Decrypt the response string [cite: 124, 125]
    const decryptedString = decryptSmartPayResponse(encResponse);
    console.log("DECRYPTED STRING:", decryptedString);

    // 2. Parse the decrypted string into an object (it's formatted like key=value&key2=value2)
    const responseParams = new URLSearchParams(decryptedString);
    const orderStatus = responseParams.get("order_status"); // [cite: 113]

    // NEW: Extract the real Prisma booking ID from merchant_param1
    const realBookingId = responseParams.get("merchant_param1");
    const locale = responseParams.get("merchant_param2") || "en";
    console.log(
      `STATUS: ${orderStatus} | BOOKING ID: ${realBookingId} | LOCALE: ${locale}`,
    );

    if (!realBookingId) {
      console.error("ERROR: merchant_param1 (Booking ID) is missing!");
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }

    // 3. Update the Prisma database based on the order status [cite: 126, 127]
    if (orderStatus === "Success") {
      // [cite: 162]
      await prisma.booking.update({
        where: { id: realBookingId },
        data: {
          status: "CONFIRMED",
          // You could also save the bankRefNo to a new field in your DB if you wish
        },
      });
      console.log("SUCCESS: Booking Confirmed!");
      // Redirect to the success page
      return NextResponse.redirect(
        `${baseUrl}/${locale}/checkout/success?bookingId=${realBookingId}`,
      );
    } else {
      console.warn("PAYMENT NOT SUCCESSFUL. Status received:", orderStatus);
      // [cite: 162]
      await prisma.booking.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      });
      // Redirect to a failure page
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }

    // Fallback redirect
    return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
  } catch (error) {
    console.error("WEBHOOK CRASHED:", error);
    return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
  }
}
