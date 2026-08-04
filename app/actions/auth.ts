"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  createAdminSessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/authSession";

// ── Login ────────────────────────────────────────────────────────────────────
// Used with React's useActionState in AdminLoginForm.
// Authenticates directly against PostgreSQL via Prisma and sets an encrypted session cookie.
export async function loginAdmin(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const locale = (formData.get("locale") as string) || "en";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // 1. Fetch user from PostgreSQL
  const adminUser = await prisma.adminUser.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
  });

  if (!adminUser) {
    return { error: "Invalid email or password. Please try again." };
  }

  // 2. Validate password
  const isValid = await verifyPassword(password, adminUser.passwordHash);
  if (!isValid) {
    return { error: "Invalid email or password. Please try again." };
  }

  // 3. Create encrypted session token
  const token = await createAdminSessionToken({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    name: adminUser.name,
  });

  // 4. Set secure HTTP-only cookie
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  redirect(`/${locale}/admin`);
}

// ── Logout ───────────────────────────────────────────────────────────────────
// Used as a <form action> in the admin layout.
export async function logoutAdmin(formData: FormData) {
  const locale = (formData.get("locale") as string) || "en";
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect(`/${locale}/admin/login`);
}
