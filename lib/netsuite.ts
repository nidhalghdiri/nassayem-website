/**
 * NetSuite integration helpers.
 *
 * Two directions:
 *  1. Inbound: NetSuite → website. Authenticated by a shared secret in the
 *     "x-netsuite-secret" header (env: NETSUITE_INBOUND_SECRET).
 *  2. Outbound: website → NetSuite. Authenticated by a pre-issued M2M access
 *     token (env: NETSUITE_M2M_TOKEN) sent as a Bearer token.
 */

const NETSUITE_OUTBOUND_URL = process.env.NETSUITE_OUTBOUND_URL || "";
const NETSUITE_M2M_TOKEN = process.env.NETSUITE_M2M_TOKEN || "";

export type NetsuitePaymentSyncPayload = {
  netsuiteReservationId: string;
  netsuiteReservationRef?: string | null;
  amount: number;
  currency: string;
  paidAt: string; // ISO timestamp
  smartpayOrderId: string;
  smartpayBankRefNo?: string | null;
  customerEmail?: string | null;
  customerName: string;
  paymentLinkId: string; // our internal NetsuitePayment.id, for traceability
};

/**
 * Verifies that an inbound request from NetSuite carries the shared secret.
 * Throws if NETSUITE_INBOUND_SECRET is not configured (fail closed).
 */
export function verifyNetsuiteInboundSecret(
  providedSecret: string | null | undefined,
): boolean {
  const expected = process.env.NETSUITE_INBOUND_SECRET;
  if (!expected) {
    console.error("[netsuite] NETSUITE_INBOUND_SECRET is not configured.");
    return false;
  }
  if (!providedSecret) return false;
  // Constant-time comparison to avoid timing attacks
  if (providedSecret.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= providedSecret.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Notifies NetSuite that a payment link has been paid.
 * Returns { ok: true } on success or { ok: false, error: string } otherwise.
 * Never throws — caller treats failure as a sync issue, not a payment failure.
 */
export async function notifyNetsuitePaymentSucceeded(
  payload: NetsuitePaymentSyncPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!NETSUITE_OUTBOUND_URL || !NETSUITE_M2M_TOKEN) {
    return {
      ok: false,
      error: "NetSuite outbound URL or M2M token not configured",
    };
  }

  try {
    const res = await fetch(NETSUITE_OUTBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NETSUITE_M2M_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `NetSuite responded ${res.status}: ${text.slice(0, 500)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
