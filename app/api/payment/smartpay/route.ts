import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptSmartPayResponse } from "@/lib/smartpay";

export async function POST(req: NextRequest) {
  // Get the locale from the query parameter we passed in the redirect_url
  const locale = req.nextUrl.searchParams.get("locale") || "en";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  try {
    // Read the form data sent by the bank
    const formData = await req.formData();
    const orderId = formData.get("order_id") as string; // [cite: 117]
    const encResponse = formData.get("encResponse") as string; // [cite: 118]

    if (!encResponse) {
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }

    // 1. Decrypt the response string [cite: 124, 125]
    const decryptedString = decryptSmartPayResponse(encResponse);

    // 2. Parse the decrypted string into an object (it's formatted like key=value&key2=value2)
    const responseParams = new URLSearchParams(decryptedString);
    const orderStatus = responseParams.get("order_status"); // [cite: 113]
    const bankRefNo = responseParams.get("bank_ref_no"); // [cite: 113]

    // 3. Update the Prisma database based on the order status [cite: 126, 127]
    if (orderStatus === "Success") {
      // [cite: 162]
      await prisma.booking.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
          // You could also save the bankRefNo to a new field in your DB if you wish
        },
      });
      // Redirect to the success page
      return NextResponse.redirect(
        `${baseUrl}/${locale}/checkout/success?bookingId=${orderId}`,
      );
    } else if (
      orderStatus === "Aborted" ||
      orderStatus === "Failure" ||
      orderStatus === "Invalid"
    ) {
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
    console.error("SmartPay Webhook Error:", error);
    return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
  }
}
