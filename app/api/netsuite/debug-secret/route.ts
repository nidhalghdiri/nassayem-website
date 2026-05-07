/**
 * Diagnostic endpoint for the NetSuite ↔ Vercel secret handshake.
 *
 * GET  /api/netsuite/debug-secret
 *   - Returns fingerprint of the env var NETSUITE_INBOUND_SECRET on Vercel.
 *
 * GET  /api/netsuite/debug-secret?candidate=<value>
 *   - Compares that <value> against the env var byte-for-byte.
 *
 * POST /api/netsuite/debug-secret
 *   - Echoes back the fingerprint of the x-netsuite-secret header that Vercel
 *     actually received. Use this from the Suitelet to prove what reached us.
 *
 * Same gating as the simulator: dev by default, prod requires
 * ALLOW_TEST_SIMULATE_PAYMENT=true.
 *
 * REMOVE this file once the issue is resolved.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function codepoints(s: string) {
  return Array.from(s).map((ch) => ch.codePointAt(0));
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function checkEnabled() {
  const isProd = process.env.NODE_ENV === "production";
  const explicitlyAllowed =
    process.env.ALLOW_TEST_SIMULATE_PAYMENT === "true";
  if (isProd && !explicitlyAllowed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Disabled in production. Set ALLOW_TEST_SIMULATE_PAYMENT=true to enable.",
      },
      { status: 403 },
    );
  }
  return null;
}

function fingerprint(value: string | null) {
  if (value === null) return null;
  const trimmed = value.trim();
  return {
    present: value.length > 0,
    length: value.length,
    trimmedLength: trimmed.length,
    hasLeadingOrTrailingWhitespace: value.length !== trimmed.length,
    first2: value.slice(0, 2),
    last2: value.slice(-2),
    codepoints: codepoints(value),
    sha256: value.length > 0 ? sha256(value) : null,
  };
}

export async function GET(req: NextRequest) {
  const blocked = checkEnabled();
  if (blocked) return blocked;

  const raw = process.env.NETSUITE_INBOUND_SECRET ?? null;

  const candidate = req.nextUrl.searchParams.get("candidate");
  let comparison: Record<string, unknown> | null = null;
  if (candidate !== null) {
    const expected = raw ?? "";
    const sameLength = candidate.length === expected.length;
    let firstMismatchIndex = -1;
    if (sameLength) {
      for (let i = 0; i < candidate.length; i++) {
        if (candidate.charCodeAt(i) !== expected.charCodeAt(i)) {
          firstMismatchIndex = i;
          break;
        }
      }
    }
    comparison = {
      candidateFingerprint: fingerprint(candidate),
      sameLength,
      firstMismatchIndex,
      match: sameLength && firstMismatchIndex === -1,
    };
  }

  return NextResponse.json({
    ok: true,
    method: "GET",
    envSecretFingerprint: fingerprint(raw),
    comparison,
    env: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      vercelDeploymentUrl: process.env.VERCEL_URL ?? null,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    note: "POST to this endpoint with x-netsuite-secret header to see what Vercel actually receives.",
  });
}

export async function POST(req: NextRequest) {
  const blocked = checkEnabled();
  if (blocked) return blocked;

  const raw = process.env.NETSUITE_INBOUND_SECRET ?? null;

  // Inspect every header the Suitelet sent so we can spot if any of the
  // multiple secret-named headers arrived with a different value than expected.
  const allHeaders: Record<string, ReturnType<typeof fingerprint>> = {};
  for (const [name, value] of req.headers.entries()) {
    if (
      /secret|auth|token|key/i.test(name) ||
      name.toLowerCase().startsWith("x-")
    ) {
      allHeaders[name] = fingerprint(value);
    }
  }

  const received = req.headers.get("x-netsuite-secret");
  const matchesEnv =
    received !== null && raw !== null && received === raw;

  return NextResponse.json({
    ok: true,
    method: "POST",
    received: {
      "x-netsuite-secret": fingerprint(received),
    },
    interestingHeaders: allHeaders,
    matchesEnv,
    envSecretFingerprint: fingerprint(raw),
    env: {
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    note: "Compare 'received.x-netsuite-secret.sha256' to 'envSecretFingerprint.sha256'. If they differ, the header was mutated in transit. Also check 'interestingHeaders' for any *other* header carrying the right value.",
  });
}
