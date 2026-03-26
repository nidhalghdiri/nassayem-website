import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import type { AdminUser } from "@prisma/client";

/**
 * Resolves the currently authenticated Supabase user → AdminUser record.
 * Returns null if not authenticated or no matching AdminUser exists.
 * Used in API route handlers to gate access and read the caller's role.
 */
export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const adminUser = await prisma.adminUser.findUnique({
    where: { supabaseId: user.id },
  });

  return adminUser;
}
