import { NextResponse } from "next/server";
import { getPurchaseRequestUser } from "@/lib/purchaseRequestAccess";
import { fetchPurchaseRequestPhoto } from "@/lib/netsuitePurchaseRequests";

/**
 * Authenticated proxy for a purchase request's photo.
 *
 * The file is private in the NetSuite File Cabinet and the Suitelet is
 * authenticated by a token the browser must never see, so the image is fetched
 * server-side and streamed back. Only SUPERVISOR and MANAGER may use it — the
 * same rule as the page, enforced here independently.
 */

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const user = await getPurchaseRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const result = await fetchPurchaseRequestPhoto(id);
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "NOT_CONFIGURED"
          ? 503
          : result.code === "UNAUTHORIZED"
            ? 502
            : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return new NextResponse(result.data.body, {
    status: 200,
    headers: {
      "Content-Type": result.data.contentType,
      // Private file behind an auth check — never let a shared cache keep it.
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
