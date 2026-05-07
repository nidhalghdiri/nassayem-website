/**
 * Diagnostic endpoint — reports the *fingerprint* of NETSUITE_INBOUND_SECRET
 * (length + first/last 2 chars + whitespace flag) so you can compare against
 * the Suitelet's log without exposing the value.
 *
 * Same gating as test-simulate-payment: dev by default, prod requires
 * ALLOW_TEST_SIMULATE_PAYMENT=true. No request auth — needed precisely
 * because the symptom we're debugging is "auth header value is wrong".
 *
 * REMOVE this file once the issue is resolved.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const isProd = process.env.NODE_ENV === "production";
  const explicitlyAllowed =
    process.env.ALLOW_TEST_SIMULATE_PAYMENT === "true";
  if (isProd && !explicitlyAllowed) {
    return NextResponse.json(
      { ok: false, error: "Disabled in production. Set ALLOW_TEST_SIMULATE_PAYMENT=true to enable." },
      { status: 403 },
    );
  }

  const raw = process.env.NETSUITE_INBOUND_SECRET;
  const trimmed = raw?.trim() ?? "";

  return NextResponse.json({
    ok: true,
    secretFingerprint: {
      present: Boolean(raw && raw.length > 0),
      length: raw?.length ?? 0,
      trimmedLength: trimmed.length,
      hasLeadingOrTrailingWhitespace: Boolean(raw && raw.length !== trimmed.length),
      first2: trimmed.slice(0, 2),
      last2: trimmed.slice(-2),
    },
    env: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      vercelDeploymentUrl: process.env.VERCEL_URL ?? null,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    note: "Compare 'secretFingerprint' here to the Suitelet's 'secretFingerprint' log. Length, first2, last2, and whitespace flag must all match.",
  });
}
