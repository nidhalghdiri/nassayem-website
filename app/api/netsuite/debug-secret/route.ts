/**
 * Diagnostic endpoint — reports the *fingerprint* of NETSUITE_INBOUND_SECRET
 * (length + first/last 2 chars + Unicode codepoints + SHA-256) so you can
 * compare it to whatever the Suitelet is sending without exposing the value.
 *
 * Same gating as test-simulate-payment: dev by default, prod requires
 * ALLOW_TEST_SIMULATE_PAYMENT=true.
 *
 * Optional: append ?candidate=<value> to compare a candidate value byte-for-byte.
 *   - Equal-length and identical-bytes => "match: true"
 *   - Anything else => returns the codepoints of both for visual diff.
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

export async function GET(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const explicitlyAllowed =
    process.env.ALLOW_TEST_SIMULATE_PAYMENT === "true";
  if (isProd && !explicitlyAllowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Disabled in production. Set ALLOW_TEST_SIMULATE_PAYMENT=true to enable.",
      },
      { status: 403 },
    );
  }

  const raw = process.env.NETSUITE_INBOUND_SECRET;
  const trimmed = raw?.trim() ?? "";

  const baseFingerprint = {
    present: Boolean(raw && raw.length > 0),
    length: raw?.length ?? 0,
    trimmedLength: trimmed.length,
    hasLeadingOrTrailingWhitespace: Boolean(raw && raw.length !== trimmed.length),
    first2: trimmed.slice(0, 2),
    last2: trimmed.slice(-2),
    // Unicode codepoint of each char — exposes hidden lookalikes
    codepoints: trimmed ? codepoints(trimmed) : [],
    // Stable hash so we can compare across systems without revealing the value
    sha256: trimmed ? sha256(trimmed) : null,
  };

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
      candidateLength: candidate.length,
      candidateCodepoints: codepoints(candidate),
      candidateSha256: sha256(candidate),
      sameLength,
      // -1 means identical (when sameLength is true) OR length differs
      firstMismatchIndex,
      match: sameLength && firstMismatchIndex === -1,
    };
  }

  return NextResponse.json({
    ok: true,
    secretFingerprint: baseFingerprint,
    comparison,
    env: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      vercelDeploymentUrl: process.env.VERCEL_URL ?? null,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    note: "Pass ?candidate=<value> to compare. Codepoints reveal Unicode lookalikes; sha256 confirms byte-equality across systems.",
  });
}
