/**
 * Helpers for extracting the bank/accounting fields out of a SmartPay
 * (CCAvenue) transaction response.
 *
 * SmartPay returns the decrypted response as a URL-encoded query string
 * (key=value&key=value&...). We persist that string verbatim in the
 * `smartpayRawResponse` column. These helpers pull the individual fields out
 * of it — used both at webhook write-time (to populate dedicated columns) and
 * at read-time (as a fallback for older records where only the raw response
 * was stored).
 */

export type SmartpayFields = {
  orderId: string | null;
  trackingId: string | null;
  bankRefNo: string | null;
  /** Masked card number, e.g. "48379150XXXXXX5613". */
  cardNumber: string | null;
  /** Card expiry as the bank sent it, e.g. "09/26". */
  cardExpiry: string | null;
  /** Card scheme/name, e.g. "Visa". */
  cardName: string | null;
  paymentMode: string | null;
  /** Bank transaction date, parsed into a Date when possible. */
  transDate: Date | null;
  /** The raw, unparsed trans_date string as the bank sent it. */
  transDateRaw: string | null;
};

const EMPTY: SmartpayFields = {
  orderId: null,
  trackingId: null,
  bankRefNo: null,
  cardNumber: null,
  cardExpiry: null,
  cardName: null,
  paymentMode: null,
  transDate: null,
  transDateRaw: null,
};

function firstNonEmpty(
  params: URLSearchParams,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value != null && value.trim() !== "") return value.trim();
  }
  return null;
}

/**
 * CCAvenue / SmartPay send trans_date as "DD/MM/YYYY HH:mm:ss"
 * (e.g. "08/06/2026 14:30:45"). Parse it into a Date in a locale-safe way.
 * Returns null if the string can't be understood.
 */
export function parseSmartpayTransDate(raw: string | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();

  // "DD/MM/YYYY HH:mm:ss" or "DD-MM-YYYY HH:mm:ss"
  const m = s.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );
  if (m) {
    const [, dd, mm, yyyy, hh, min, ss] = m;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      ss ? Number(ss) : 0,
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Fall back to the native parser (handles ISO strings).
  const native = new Date(s);
  return Number.isNaN(native.getTime()) ? null : native;
}

/**
 * Extract the accounting-relevant fields from a SmartPay response. Accepts the
 * raw query-string (the usual case) or an already-parsed object (defensive —
 * in case a record was stored as a JSON object).
 */
export function extractSmartpayFields(raw: unknown): SmartpayFields {
  if (raw == null) return EMPTY;

  let params: URLSearchParams;
  if (typeof raw === "string") {
    try {
      params = new URLSearchParams(raw);
    } catch {
      return EMPTY;
    }
  } else if (typeof raw === "object") {
    params = new URLSearchParams();
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v != null) params.set(k, String(v));
    }
  } else {
    return EMPTY;
  }

  const transDateRaw = firstNonEmpty(params, [
    "trans_date",
    "transaction_date",
    "order_date_time",
  ]);

  return {
    orderId: firstNonEmpty(params, ["order_id", "order_no"]),
    trackingId: firstNonEmpty(params, ["tracking_id"]),
    bankRefNo: firstNonEmpty(params, ["bank_ref_no", "order_bank_ref_no"]),
    // SmartPay returns the masked card number in merchant_param6 (card_number
    // is empty in their response), with expiry in merchant_param7.
    cardNumber: firstNonEmpty(params, [
      "card_number",
      "card_no",
      "merchant_param6",
    ]),
    cardExpiry: firstNonEmpty(params, ["merchant_param7"]),
    cardName: firstNonEmpty(params, ["card_name"]),
    paymentMode: firstNonEmpty(params, ["payment_mode"]),
    transDate: parseSmartpayTransDate(transDateRaw),
    transDateRaw,
  };
}
