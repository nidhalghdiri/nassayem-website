"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ── Invite a new admin user ──────────────────────────────────────────────────
// Creates a Supabase Auth user (sends an invitation email) and stores the
// corresponding AdminUser profile in our database.
export async function inviteAdminUser(
  _prevState: { error: string | null; success: string | null },
  formData: FormData,
): Promise<{ error: string | null; success: string | null }> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const locale = (formData.get("locale") as string) || "en";

  if (!email) {
    return { error: "Email is required.", success: null };
  }

  // Check if already exists in our DB
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return { error: "A user with this email already exists.", success: null };
  }

  // Invite via Supabase Admin API — sends the invitation email automatically
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { name },
      redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/${locale}/admin`,
    },
  );

  if (error) {
    return { error: error.message, success: null };
  }

  // Persist the admin profile in our database
  await prisma.adminUser.create({
    data: {
      supabaseId: data.user.id,
      email,
      name,
    },
  });

  revalidatePath(`/en/admin/users`);
  revalidatePath(`/ar/admin/users`);

  return {
    error: null,
    success: `Invitation sent to ${email}. They will receive an email to set their password.`,
  };
}

// ── Delete an admin user ─────────────────────────────────────────────────────
// Removes from both Supabase Auth and our AdminUser table.
// Prevents self-deletion.
export async function deleteAdminUser(formData: FormData) {
  const adminUserId = formData.get("adminUserId") as string;
  const supabaseId = formData.get("supabaseId") as string;
  const locale = (formData.get("locale") as string) || "en";

  // Prevent self-deletion
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser?.id === supabaseId) {
    // Can't delete yourself — just return silently (UI should also prevent this)
    return;
  }

  // Delete from Supabase Auth
  await supabaseAdmin.auth.admin.deleteUser(supabaseId);

  // Delete from Prisma
  await prisma.adminUser.delete({ where: { id: adminUserId } });

  revalidatePath(`/${locale}/admin/users`);
}
