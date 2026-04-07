/**
 * Thin wrapper around window.gtag so every event call is type-safe and
 * silently no-ops in environments where the GA script hasn't loaded yet
 * (SSR, unit tests, ad-blockers, etc.).
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

interface GaItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
}

interface GaEventParams {
  currency?: string;
  value?: number;
  transaction_id?: string;
  items?: GaItem[];
  [key: string]: unknown;
}

export function gtagEvent(eventName: string, params: GaEventParams = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}
