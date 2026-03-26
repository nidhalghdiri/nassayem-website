"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";
import type { StaffRole } from "@prisma/client";

function revalidateUsers() {
  revalidatePath("/en/admin/users");
  revalidatePath("/ar/admin/users");
}

// ── Create a new admin user (email + password, no email invite) ───────────────
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

  if (!email || !password) {
    return { error: "Email and password are required.", success: false };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return { error: "A user with this email already exists.", success: false };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip verification — user can sign in immediately
    user_metadata: { name },
  });

  if (error) return { error: error.message, success: false };

  await prisma.adminUser.create({
    data: { supabaseId: data.user.id, email, name, role },
  });

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

  // Prevent manager from changing their own role
  if (adminUserId === currentUser.id && role !== "MANAGER") {
    return { error: "You cannot change your own role.", success: false };
  }

  if (newPassword && newPassword.length < 8) {
    return { error: "New password must be at least 8 characters.", success: false };
  }

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { name, role },
  });

  if (newPassword) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(supabaseId, {
      password: newPassword,
    });
    if (error) return { error: `Password update failed: ${error.message}`, success: false };
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
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  if (sessionUser?.id === supabaseId) return;

  await supabaseAdmin.auth.admin.deleteUser(supabaseId);
  await prisma.adminUser.delete({ where: { id: adminUserId } });

  revalidateUsers();
}
