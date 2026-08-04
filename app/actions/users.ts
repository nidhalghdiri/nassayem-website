"use server";

import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/authSession";
import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import type { StaffRole } from "@prisma/client";

function revalidateUsers() {
  revalidatePath("/en/admin/users");
  revalidatePath("/ar/admin/users");
}

// ── Create a new admin user (Direct Database) ─────────────────────────────────
// MANAGER only.
export async function createAdminUser(
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const currentUser = await getCurrentAdminUser();
  if (!currentUser || currentUser.role !== "MANAGER") {
    return { error: "Only Managers can create users.", success: false };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = (formData.get("password") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() || null;
  const role = (formData.get("role") as StaffRole) || "MANAGER";
  const whatsappNumber =
    (formData.get("whatsappNumber") as string)?.trim().replace(/\D/g, "") ||
    null;
  const preferredLanguage =
    (formData.get("preferredLanguage") as string) === "ar" ? "ar" : "en";

  if (!email || !password) {
    return { error: "Email and password are required.", success: false };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }

  const existing = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) {
    return { error: "A user with this email already exists.", success: false };
  }

  // 1. Hash password cryptographically
  const passwordHash = await hashPassword(password);

  // 2. Optional Supabase Auth mirror (non-blocking)
  let supabaseId: string | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (data?.user?.id) {
      supabaseId = data.user.id;
    }
  } catch {
    // Ignore Supabase errors if quota is reached
  }

  // 3. Create user in PostgreSQL
  const newUser = await prisma.adminUser.create({
    data: {
      supabaseId,
      email,
      passwordHash,
      name,
      role,
      whatsappNumber,
      preferredLanguage,
    },
  });

  if (role === "RECEPTIONIST") {
    const buildingIds = (formData.getAll("buildingIds") as string[]).filter(
      Boolean,
    );
    if (buildingIds.length > 0) {
      await prisma.adminUserBuilding.createMany({
        data: buildingIds.map((bId) => ({
          adminUserId: newUser.id,
          buildingId: bId,
        })),
        skipDuplicates: true,
      });
    }
  }

  revalidateUsers();
  return { error: null, success: true };
}

// ── Update an admin user (name, role, optional new password) ──────────────────
// MANAGER only. A manager cannot downgrade themselves.
export async function updateAdminUser(
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const currentUser = await getCurrentAdminUser();
  if (!currentUser || currentUser.role !== "MANAGER") {
    return { error: "Only Managers can edit users.", success: false };
  }

  const adminUserId = formData.get("adminUserId") as string;
  const supabaseId = formData.get("supabaseId") as string;
  const name = (formData.get("name") as string)?.trim() || null;
  const role = formData.get("role") as StaffRole;
  const newPassword = (formData.get("password") as string)?.trim();
  const whatsappNumber =
    (formData.get("whatsappNumber") as string)?.trim().replace(/\D/g, "") ||
    null;
  const preferredLanguage =
    (formData.get("preferredLanguage") as string) === "ar" ? "ar" : "en";

  // Prevent manager from changing their own role
  if (adminUserId === currentUser.id && role !== "MANAGER") {
    return { error: "You cannot change your own role.", success: false };
  }

  if (newPassword && newPassword.length < 8) {
    return {
      error: "New password must be at least 8 characters.",
      success: false,
    };
  }

  const updateData: {
    name: string | null;
    role: StaffRole;
    whatsappNumber: string | null;
    preferredLanguage: string;
    passwordHash?: string;
  } = { name, role, whatsappNumber, preferredLanguage };

  if (newPassword) {
    updateData.passwordHash = await hashPassword(newPassword);
  }

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: updateData,
  });

  // Sync building assignments (only meaningful for RECEPTIONIST; clear for other roles)
  if (role === "RECEPTIONIST") {
    const buildingIds = (formData.getAll("buildingIds") as string[]).filter(
      Boolean,
    );
    await prisma.adminUserBuilding.deleteMany({ where: { adminUserId } });
    if (buildingIds.length > 0) {
      await prisma.adminUserBuilding.createMany({
        data: buildingIds.map((bId) => ({
          adminUserId,
          buildingId: bId,
        })),
        skipDuplicates: true,
      });
    }
  } else {
    await prisma.adminUserBuilding.deleteMany({ where: { adminUserId } });
  }

  // Optional Supabase update (non-blocking)
  if (newPassword && supabaseId) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(supabaseId, {
        password: newPassword,
      });
    } catch {
      // Ignore Supabase sync failure
    }
  }

  revalidateUsers();
  return { error: null, success: true };
}

// ── Delete an admin user ──────────────────────────────────────────────────────
// MANAGER only. Prevents self-deletion.
export async function deleteAdminUser(formData: FormData) {
  const currentUser = await getCurrentAdminUser();
  if (!currentUser || currentUser.role !== "MANAGER") return;

  const adminUserId = formData.get("adminUserId") as string;
  const supabaseId = formData.get("supabaseId") as string;

  // Prevent self-deletion
  if (currentUser.id === adminUserId) return;

  if (supabaseId) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(supabaseId);
    } catch {
      // Ignore Supabase error
    }
  }
  await prisma.adminUser.delete({ where: { id: adminUserId } });

  revalidateUsers();
}
