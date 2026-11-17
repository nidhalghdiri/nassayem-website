import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  loadAssignedBuildings,
  mobileError,
  requireMobileUser,
  toMobileUser,
} from "@/lib/mobileApi";

// ── GET /api/mobile/v1/me ────────────────────────────────────────────────────
// The signed-in staff member: profile, role, assigned buildings and the app
// sections their role can open. The app calls it on launch to confirm the
// stored token is still valid.
export async function GET() {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  return NextResponse.json({
    user: toMobileUser(user, await loadAssignedBuildings(user.id)),
  });
}

const UpdateMeBody = z.object({
  preferredLanguage: z.enum(["en", "ar"]),
});

// ── PATCH /api/mobile/v1/me ──────────────────────────────────────────────────
// Saves the language chosen in the app, which also sets the language of the
// staff member's WhatsApp notifications.
export async function PATCH(request: Request) {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  const parsed = UpdateMeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return mobileError("VALIDATION", 400);

  const updated = await prisma.adminUser.update({
    where: { id: user.id },
    data: { preferredLanguage: parsed.data.preferredLanguage },
  });

  return NextResponse.json({
    user: toMobileUser(updated, await loadAssignedBuildings(user.id)),
  });
}
