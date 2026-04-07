"use client";

import { useEffect } from "react";
import { gtagEvent } from "@/lib/gtag";

interface Props {
  itemId: string;
  itemName: string;
  itemCategory: string; // e.g. "DAILY" | "MONTHLY"
  price: number | null;
}

/**
 * Drop this anywhere in the property details page (server component).
 * It fires GA4 view_item once the page is visible in the browser.
 */
export default function GaViewItem({
  itemId,
  itemName,
  itemCategory,
  price,
}: Props) {
  useEffect(() => {
    gtagEvent("view_item", {
      currency: "OMR",
      value: price ?? 0,
      items: [
        {
          item_id: itemId,
          item_name: itemName,
          item_category: itemCategory,
          price: price ?? 0,
          quantity: 1,
        },
      ],
    });
    // Only fires once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
