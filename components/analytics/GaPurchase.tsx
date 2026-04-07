"use client";

import { useEffect } from "react";
import { gtagEvent } from "@/lib/gtag";

interface Props {
  transactionId: string; // booking.bookingCode or booking.id
  itemId: string;
  itemName: string;
  itemCategory: string;
  value: number;
}

/**
 * Drop this in the checkout/success page (server component).
 * Fires GA4 purchase once the confirmation page loads in the browser.
 */
export default function GaPurchase({
  transactionId,
  itemId,
  itemName,
  itemCategory,
  value,
}: Props) {
  useEffect(() => {
    gtagEvent("purchase", {
      transaction_id: transactionId,
      currency: "OMR",
      value,
      items: [
        {
          item_id: itemId,
          item_name: itemName,
          item_category: itemCategory,
          price: value,
          quantity: 1,
        },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
