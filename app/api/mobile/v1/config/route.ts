import { NextResponse } from "next/server";
import { MIN_MOBILE_APP_VERSION } from "@/lib/mobileApi";

// ── GET /api/mobile/v1/config ────────────────────────────────────────────────
// Public. Checked by the app on launch: a build older than minAppVersion shows
// an "update required" screen instead of calling an API it no longer matches.
export async function GET() {
  return NextResponse.json({ minAppVersion: MIN_MOBILE_APP_VERSION });
}
