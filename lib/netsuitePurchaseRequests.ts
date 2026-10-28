/**
 * NetSuite Purchase Request API client.
 *
 * Employees submit purchase requests from a NetSuite Suitelet. The approval
 * chain is Supervisor → Accounts → General Manager. Supervisors have no
 * NetSuite access, so they decide on this website; Accounts and the GM decide
 * inside NetSuite.
 *
 * The website never writes to NetSuite directly — every read and write goes
 * through the already-deployed "Purchase Request API" Suitelet, whose external
 * URL is in NETSUITE_PUR_REQ_API_URL. See lib/netsuite.ts →
 * callNetsuiteSuitelet for the transport constraints (GET only, token in the
 * query, never an Authorization header).
 *
 * SERVER ONLY. These functions read NETSUITE_M2M_TOKEN, which must never reach
 * the client. Call them from Server Components, Server Actions and route
 * handlers only — never from a "use client" module.
 */

import {
  callNetsuiteSuitelet,
  callNetsuiteSuiteletJson,
} from "@/lib/netsuite";

// ── Status codes ────────────────────────────────────────────────────────────
// The API always speaks these codes, never NetSuite internal list IDs.

export const PURCHASE_REQUEST_STATUSES = [
  "pending_supervisor",
  "pending_accounts",
  "pending_gm",
  "approved",
  "rejected",
] as const;

export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number];

export function isPurchaseRequestStatus(
  value: string,
): value is PurchaseRequestStatus {
  return (PURCHASE_REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Bilingual labels for each status code, for the list and detail badges. */
export const PURCHASE_REQUEST_STATUS_LABELS: Record<
  PurchaseRequestStatus,
  { en: string; ar: string }
> = {
  pending_supervisor: { en: "Pending Supervisor", ar: "بانتظار المشرف" },
  pending_accounts: { en: "Pending Accounts", ar: "بانتظار الحسابات" },
  pending_gm: { en: "Pending General Manager", ar: "بانتظار المدير العام" },
  approved: { en: "Approved", ar: "معتمد" },
  rejected: { en: "Rejected", ar: "مرفوض" },
};

export type PurchaseRequestPriority = "normal" | "urgent";

export type PurchaseRequestRejectStage = "supervisor" | "accounts" | "gm";

// ── Error codes ─────────────────────────────────────────────────────────────
// The API's own codes, plus two the client adds so callers can branch on every
// failure with one switch:
//   NOT_CONFIGURED — NETSUITE_PUR_REQ_API_URL / NETSUITE_M2M_TOKEN unset.
//   NETWORK        — timeout, DNS, non-JSON HTML error page.

export type PurchaseRequestApiCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "INVALID_PARAMS"
  | "FORBIDDEN_LOCATION"
  | "SERVER_ERROR"
  | "NOT_CONFIGURED"
  | "NETWORK";

export type PurchaseRequestFailure = {
  ok: false;
  code: PurchaseRequestApiCode;
  error: string;
  /** Present when the API rejected a decide with INVALID_STATUS. */
  status?: PurchaseRequestStatus;
};

export type PurchaseRequestResult<T> = { ok: true; data: T } | PurchaseRequestFailure;

// ── Row / detail shapes ─────────────────────────────────────────────────────

/** One approval stage, null until that stage has acted. */
export type PurchaseRequestStage = {
  name: string | null;
  /** Website AdminUser.id — supervisor stage only. */
  ref?: string | null;
  /** ISO timestamp. */
  date: string | null;
  note?: string | null;
} | null;

export type PurchaseRequestRow = {
  /** NetSuite internal id of the custom record, as a string. */
  id: string;
  /** Auto-numbered request number, e.g. "PUR00012". */
  number: string;
  /** YYYY-MM-DD. */
  date: string;
  status: PurchaseRequestStatus;
  /** Pre-formatted bilingual label from NetSuite ("en - ar"). */
  statusLabel: string;
  /** NetSuite location internal id — matches Building.netsuiteId. */
  locationId: string | null;
  locationName: string | null;
  requesterId: string | null;
  requesterName: string | null;
  reason: string | null;
  priority: PurchaseRequestPriority;
  tenantCharge: boolean;
  estimatedTotal: number;
  currency: string;
  hasPhoto: boolean;
  itemCount: number;
  supervisor: PurchaseRequestStage;
  accounts: PurchaseRequestStage;
  gm: PurchaseRequestStage;
  rejectReason: string | null;
  rejectedStage: PurchaseRequestRejectStage | null;
};

export type PurchaseRequestItem = {
  id: string;
  description: string | null;
  quantity: number;
  price: number;
  total: number;
};

export type PurchaseRequestDetail = PurchaseRequestRow & {
  items: PurchaseRequestItem[];
};

export type PurchaseRequestListPage = {
  page: number;
  pageSize: number;
  total: number;
  requests: PurchaseRequestRow[];
};

// ── Configuration ───────────────────────────────────────────────────────────

/**
 * True when the Purchase Request API can be called. When false, pages show a
 * "not configured" state instead of crashing — the module is deploy-safe
 * before NETSUITE_PUR_REQ_API_URL is set in Vercel.
 */
export function isPurchaseRequestApiConfigured(): boolean {
  return !!(process.env.NETSUITE_PUR_REQ_API_URL && process.env.NETSUITE_M2M_TOKEN);
}

function notConfigured(): PurchaseRequestFailure {
  return {
    ok: false,
    code: "NOT_CONFIGURED",
    error: "NETSUITE_PUR_REQ_API_URL or NETSUITE_M2M_TOKEN is not configured",
  };
}

function apiUrl(): string {
  return process.env.NETSUITE_PUR_REQ_API_URL || "";
}

/**
 * Maps a JSON-envelope failure onto a typed code. callNetsuiteSuiteletJson
 * surfaces the API's `code` when it sent one; anything else is a transport or
 * parse problem, which callers present as "NetSuite unreachable".
 */
function toFailure(failure: { error: string; code?: string }): PurchaseRequestFailure {
  const known: PurchaseRequestApiCode[] = [
    "UNAUTHORIZED",
    "NOT_FOUND",
    "INVALID_STATUS",
    "INVALID_PARAMS",
    "FORBIDDEN_LOCATION",
    "SERVER_ERROR",
  ];
  const code = known.find((c) => c === failure.code) ?? "NETWORK";
  return { ok: false, code, error: failure.error };
}

// ── Normalisation ───────────────────────────────────────────────────────────
// NetSuite sends numbers as numbers but empty values inconsistently (""/null),
// so coerce defensively rather than trusting the payload shape.

function num(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function normalizeStage(raw: unknown): PurchaseRequestStage {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stage = {
    name: str(r.name),
    ref: str(r.ref),
    date: str(r.date),
    note: str(r.note),
  };
  // A stage object with nothing in it means the stage has not acted.
  if (!stage.name && !stage.date && !stage.note) return null;
  return stage;
}

function normalizeRow(raw: Record<string, unknown>): PurchaseRequestRow {
  const rawStatus = String(raw.status ?? "");
  const rawStage = String(raw.rejectedStage ?? "");
  return {
    id: String(raw.id ?? ""),
    number: String(raw.number ?? ""),
    date: String(raw.date ?? ""),
    // Fall back to pending_supervisor only for display safety; an unknown
    // status still renders rather than breaking the whole list.
    status: isPurchaseRequestStatus(rawStatus) ? rawStatus : "pending_supervisor",
    statusLabel: String(raw.statusLabel ?? ""),
    locationId: str(raw.locationId),
    locationName: str(raw.locationName),
    requesterId: str(raw.requesterId),
    requesterName: str(raw.requesterName),
    reason: str(raw.reason),
    priority: String(raw.priority ?? "").toLowerCase() === "urgent" ? "urgent" : "normal",
    tenantCharge: raw.tenantCharge === true || raw.tenantCharge === "T",
    estimatedTotal: num(raw.estimatedTotal),
    currency: String(raw.currency || "OMR"),
    hasPhoto: raw.hasPhoto === true,
    itemCount: num(raw.itemCount),
    supervisor: normalizeStage(raw.supervisor),
    accounts: normalizeStage(raw.accounts),
    gm: normalizeStage(raw.gm),
    rejectReason: str(raw.rejectReason),
    rejectedStage:
      rawStage === "supervisor" || rawStage === "accounts" || rawStage === "gm"
        ? rawStage
        : null,
  };
}

function normalizeItem(raw: Record<string, unknown>): PurchaseRequestItem {
  return {
    id: String(raw.id ?? ""),
    description: str(raw.description),
    quantity: num(raw.quantity),
    price: num(raw.price),
    total: num(raw.total),
  };
}

// ── action=list ─────────────────────────────────────────────────────────────

export type ListPurchaseRequestsParams = {
  /** A status code or "all". The API defaults to pending_supervisor. */
  status?: PurchaseRequestStatus | "all";
  /** NetSuite location ids. Omit to cover all buildings. */
  locationIds?: string[];
  /** YYYY-MM-DD. */
  dateFrom?: string;
  dateTo?: string;
  /** 0-based. */
  page?: number;
  /** 1–100, default 25. */
  pageSize?: number;
};

/** Lists purchase requests, newest first. */
export async function listPurchaseRequests(
  params: ListPurchaseRequestsParams = {},
): Promise<PurchaseRequestResult<PurchaseRequestListPage>> {
  if (!isPurchaseRequestApiConfigured()) return notConfigured();

  const result = await callNetsuiteSuiteletJson<Record<string, unknown>>(apiUrl(), {
    action: "list",
    status: params.status,
    locationIds: params.locationIds?.length ? params.locationIds.join(",") : undefined,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page: params.page,
    pageSize: params.pageSize,
  });
  if (!result.ok) return toFailure(result);

  const raw = result.data;
  const requests = Array.isArray(raw.requests) ? raw.requests : [];
  return {
    ok: true,
    data: {
      page: num(raw.page),
      pageSize: num(raw.pageSize),
      total: num(raw.total),
      requests: requests.map((r) => normalizeRow(r as Record<string, unknown>)),
    },
  };
}

// ── action=get ──────────────────────────────────────────────────────────────

/** Fetches one request with its item lines. */
export async function getPurchaseRequest(
  id: string,
): Promise<PurchaseRequestResult<PurchaseRequestDetail>> {
  if (!isPurchaseRequestApiConfigured()) return notConfigured();

  const result = await callNetsuiteSuiteletJson<Record<string, unknown>>(apiUrl(), {
    action: "get",
    id,
  });
  if (!result.ok) return toFailure(result);

  const raw = result.data.request;
  if (!raw || typeof raw !== "object") {
    return { ok: false, code: "NOT_FOUND", error: "NetSuite returned no request" };
  }
  const row = raw as Record<string, unknown>;
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    ok: true,
    data: {
      ...normalizeRow(row),
      items: items.map((i) => normalizeItem(i as Record<string, unknown>)),
    },
  };
}

// ── action=photo ────────────────────────────────────────────────────────────

export type PurchaseRequestPhoto = {
  contentType: string;
  body: ArrayBuffer;
};

/**
 * Fetches the request's photo (image or PDF) as bytes.
 *
 * The file is private in the NetSuite File Cabinet, so the browser must never
 * call the Suitelet directly — this is proxied through an authenticated
 * website route. When there is no photo the Suitelet answers with JSON
 * (`ok:false, code:"NOT_FOUND"`) rather than a file, which is detected here by
 * the response content type.
 */
export async function fetchPurchaseRequestPhoto(
  id: string,
): Promise<PurchaseRequestResult<PurchaseRequestPhoto>> {
  if (!isPurchaseRequestApiConfigured()) return notConfigured();

  const call = await callNetsuiteSuitelet(apiUrl(), { action: "photo", id });
  if (!call.ok) return { ok: false, code: "NETWORK", error: call.error };

  const { res } = call;
  const contentType = res.headers.get("content-type") || "application/octet-stream";

  // A JSON body here is the error envelope, not a file.
  if (contentType.includes("application/json")) {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as { code?: string; error?: string };
      return toFailure({
        error: parsed.error ?? "No photo on this request",
        code: parsed.code,
      });
    } catch {
      return { ok: false, code: "NETWORK", error: `NetSuite returned: ${text.slice(0, 200)}` };
    }
  }
  if (!res.ok) {
    return {
      ok: false,
      code: "NETWORK",
      error: `NetSuite ${res.status} fetching the photo`,
    };
  }

  return {
    ok: true,
    data: { contentType, body: await res.arrayBuffer() },
  };
}

// ── action=decide ───────────────────────────────────────────────────────────

export const PURCHASE_REQUEST_NOTE_MAX = 1000;

export type DecidePurchaseRequestParams = {
  id: string;
  decision: "approve" | "reject";
  /** Required for reject, optional for approve. Max 1000 characters. */
  note?: string;
  /** The deciding website user's name. */
  actorName: string;
  /** The deciding website user's AdminUser.id. */
  actorRef: string;
  /**
   * Building scoping. Supervisors currently see all buildings, so callers
   * leave this unset — NetSuite then skips the location check. Kept here so
   * scoping can be switched on later without touching the API contract.
   */
  locationIds?: string[];
};

export type PurchaseRequestDecided = {
  id: string;
  status: PurchaseRequestStatus;
};

/**
 * Records the supervisor's decision in NetSuite. Approving moves the request to
 * pending_accounts; rejecting sets rejected with rejectedStage="supervisor".
 *
 * Only valid while the request is pending_supervisor — otherwise the API
 * answers INVALID_STATUS with the current status, which the caller surfaces as
 * "someone already acted on this request".
 *
 * This is a GET that changes data. Call it ONLY from a Server Action behind an
 * explicit button click — never from a page render, a link or a prefetch.
 */
export async function decidePurchaseRequest(
  params: DecidePurchaseRequestParams,
): Promise<PurchaseRequestResult<PurchaseRequestDecided>> {
  if (!isPurchaseRequestApiConfigured()) return notConfigured();

  const note = params.note?.trim() ?? "";
  if (params.decision === "reject" && !note) {
    return { ok: false, code: "INVALID_PARAMS", error: "A reason is required to reject" };
  }
  if (note.length > PURCHASE_REQUEST_NOTE_MAX) {
    return {
      ok: false,
      code: "INVALID_PARAMS",
      error: `The note must be at most ${PURCHASE_REQUEST_NOTE_MAX} characters`,
    };
  }

  const result = await callNetsuiteSuiteletJson<Record<string, unknown>>(apiUrl(), {
    action: "decide",
    id: params.id,
    decision: params.decision,
    note: note || undefined,
    actorName: params.actorName,
    actorRef: params.actorRef,
    locationIds: params.locationIds?.length ? params.locationIds.join(",") : undefined,
  });

  if (!result.ok) {
    const failure = toFailure(result);
    // INVALID_STATUS carries the status someone else moved the request to.
    if (failure.code === "INVALID_STATUS") {
      const current = String(result.body?.status ?? "");
      if (isPurchaseRequestStatus(current)) failure.status = current;
    }
    return failure;
  }

  const raw = result.data.request;
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const status = String(row.status ?? "");
  return {
    ok: true,
    data: {
      id: String(row.id ?? params.id),
      status: isPurchaseRequestStatus(status)
        ? status
        : params.decision === "approve"
          ? "pending_accounts"
          : "rejected",
    },
  };
}
