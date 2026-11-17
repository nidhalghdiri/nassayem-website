import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { mobileError, requireMobileUser } from "@/lib/mobileApi";

const DeviceBody = z.object({
  expoPushToken: z.string().min(1).max(255),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().max(32).optional(),
});

// ── POST /api/mobile/v1/devices ──────────────────────────────────────────────
// Registers (or refreshes) this phone's push token for the signed-in user. A
// token moves to whoever signed in last on that phone.
export async function POST(request: Request) {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  const parsed = DeviceBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return mobileError("VALIDATION", 400);
  const { expoPushToken, platform, appVersion } = parsed.data;

  await prisma.mobileDevice.upsert({
    where: { expoPushToken },
    create: { expoPushToken, platform, appVersion, adminUserId: user.id },
    update: { platform, appVersion, adminUserId: user.id, lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

const DeleteBody = z.object({ expoPushToken: z.string().min(1).max(255) });

// ── DELETE /api/mobile/v1/devices ────────────────────────────────────────────
// Called on sign-out so the phone stops receiving this user's notifications.
export async function DELETE(request: Request) {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  const parsed = DeleteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return mobileError("VALIDATION", 400);

  await prisma.mobileDevice.deleteMany({
    where: { expoPushToken: parsed.data.expoPushToken, adminUserId: user.id },
  });

  return NextResponse.json({ ok: true });
}
