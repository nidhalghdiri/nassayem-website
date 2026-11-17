import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createAdminSessionToken, verifyPassword } from "@/lib/authSession";
import {
  clearLoginFailures,
  isLoginThrottled,
  loadAssignedBuildings,
  mobileError,
  recordLoginFailure,
  toMobileUser,
} from "@/lib/mobileApi";

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// ── POST /api/mobile/v1/auth/login ───────────────────────────────────────────
// Staff sign in with their website credentials. Returns the same signed
// session token the website stores in its cookie; the app keeps it in the
// device's secure storage and sends it as a Bearer token.
export async function POST(request: Request) {
  const parsed = LoginBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return mobileError("VALIDATION", 400, "Email and password are required.");
  }
  const { email, password } = parsed.data;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const throttleKey = `${ip}|${email}`;
  if (isLoginThrottled(throttleKey)) {
    return mobileError("TOO_MANY_ATTEMPTS", 429, "Too many attempts. Try again later.");
  }

  const user = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordLoginFailure(throttleKey);
    return mobileError("INVALID_CREDENTIALS", 401, "Invalid email or password.");
  }
  clearLoginFailures(throttleKey);

  const token = await createAdminSessionToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    sessionVersion: user.sessionVersion,
  });

  return NextResponse.json({
    token,
    user: toMobileUser(user, await loadAssignedBuildings(user.id)),
  });
}
