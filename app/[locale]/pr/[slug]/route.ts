/**
 * Short link behind the "مراجعة الطلب" button of the WhatsApp template
 * ns_purchase_request_to_approve (button URL https://www.nassayem.com/pr/{{1}};
 * the middleware adds the locale, so it arrives here as /<locale>/pr/<slug>).
 *
 *   <id>                → supervisor: the request in the admin panel
 *   ns-<rectype>-<id>   → accountant / general manager: the NetSuite record
 *                         (rectype is the custom record type's internal id,
 *                         put in the suffix by NS_UE_PUR_REQ.js)
 *
 * Only digits are accepted and both destinations are fixed, so this cannot be
 * used as an open redirect. Not logged in → the admin login, then back here.
 */

import { NextRequest, NextResponse } from "next/server";

const NETSUITE_RECORD_URL =
  "https://11661334.app.netsuite.com/app/common/custom/custrecordentry.nl";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { slug } = await params;

  const netsuite = /^ns-(\d+)-(\d+)$/.exec(slug);
  if (netsuite) {
    const [, rectype, id] = netsuite;
    return NextResponse.redirect(`${NETSUITE_RECORD_URL}?rectype=${rectype}&id=${id}`);
  }

  // Supervisors use the Arabic admin panel
  const target = new URL("/ar/admin/purchase-requests", req.nextUrl.origin);
  // The detail opens by id on any tab; the default (pending) tab is where
  // the supervisor acts.
  if (/^\d+$/.test(slug)) target.searchParams.set("id", slug);
  return NextResponse.redirect(target);
}
