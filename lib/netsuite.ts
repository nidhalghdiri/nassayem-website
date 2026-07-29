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

// ── Chatbot RESTlet (real-time availability + reservation creation) ──────────
// One RESTlet handles both actions (netsuite/rl_chatbot.js), authenticated by
// the same Bearer M2M token. Env: NETSUITE_CHATBOT_RESTLET_URL. When unset,
// isNetsuiteChatbotConfigured() is false and the chatbot falls back to
// website-side availability — deploy-safe before the RESTlet exists.

const NETSUITE_CHATBOT_RESTLET_URL = process.env.NETSUITE_CHATBOT_RESTLET_URL || "";
const RESTLET_TIMEOUT_MS = 20_000; // NetSuite RESTlets can be slow

export function isNetsuiteChatbotConfigured(): boolean {
  return !!(NETSUITE_CHATBOT_RESTLET_URL && NETSUITE_M2M_TOKEN);
}

async function callChatbotRestlet<T>(
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!isNetsuiteChatbotConfigured()) {
    return { ok: false, error: "NetSuite chatbot RESTlet not configured" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESTLET_TIMEOUT_MS);
  try {
    // GET with query params — externally-called Suitelets reject POST (405)
    // on some URL domains. Auth is the `token` query param ONLY: an
    // Authorization header must NOT be sent, because NetSuite intercepts it
    // and tries to validate it as a NetSuite OAuth token before the Suitelet
    // runs — failing with an HTML error page.
    const url = new URL(NETSUITE_CHATBOT_RESTLET_URL);
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    url.searchParams.set("token", NETSUITE_M2M_TOKEN);

    const res = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `NetSuite ${res.status}: ${text.slice(0, 400)}` };
    }
    const data = JSON.parse(text) as T & { ok?: boolean; error?: string };
    if (data && data.ok === false) {
      return { ok: false, error: data.error ?? "NetSuite returned ok:false" };
    }
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === "AbortError"
          ? "NetSuite request timed out"
          : err instanceof Error
            ? err.message
            : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export type NetsuiteAvailability = {
  ok: boolean;
  totalUnits: number;
  freeUnits: number;
  /** A few free unit codes, informational (e.g. ["OK-305"]). */
  freeUnitCodes?: string[];
};

/**
 * Real-time availability from NetSuite for a (building, unit type, date range).
 * unitType is the WEBSITE enum value (STUDIO/ONE_BEDROOM/...) — the RESTlet's
 * EDIT-ME config maps it to the NetSuite unit-type values (1BHK/2BHK/...).
 */
export async function checkNetsuiteAvailability(params: {
  netsuiteBuildingId?: string | null;
  unitType: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
}): Promise<{ ok: true; data: NetsuiteAvailability } | { ok: false; error: string }> {
  return callChatbotRestlet<NetsuiteAvailability>({
    action: "check_availability",
    ...params,
  });
}

export type NetsuiteReservationCreated = {
  ok: boolean;
  reservationId: string;
  reservationRef?: string;
  unitCode?: string;
};

/**
 * Creates a reservation in NetSuite. The RESTlet re-checks availability and
 * picks a free unit of the requested type itself (closest thing to atomicity
 * NetSuite gives us), returning the chosen unit code.
 */
export async function createNetsuiteReservation(params: {
  netsuiteBuildingId?: string | null;
  unitType: string;
  checkIn: string;
  checkOut: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  /** National ID or passport number — stored on the reservation + customer. */
  idPassport?: string | null;
  totalAmount: number;
  notes?: string;
  /** Keep the DAILY cycle even for 30+ nights (Khareef has no monthly rentals). */
  forceDaily?: boolean;
  conversationId: string;
}): Promise<
  { ok: true; data: NetsuiteReservationCreated } | { ok: false; error: string }
> {
  return callChatbotRestlet<NetsuiteReservationCreated>({
    action: "create_reservation",
    source: "chatbot",
    ...params,
  });
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
    const url = new URL(NETSUITE_OUTBOUND_URL);
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${NETSUITE_M2M_TOKEN}`,
      },
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
