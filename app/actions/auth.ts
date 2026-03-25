"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

// ── Login ────────────────────────────────────────────────────────────────────
// Used with React's useActionState in AdminLoginForm.
// Returns an error string on failure, or redirects to the dashboard on success.
export async function loginAdmin(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const locale = (formData.get("locale") as string) || "en";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Return a generic message — do not expose Supabase internals to the UI
    return { error: "Invalid email or password. Please try again." };
  }

  redirect(`/${locale}/admin`);
}

// ── Logout ───────────────────────────────────────────────────────────────────
// Used as a <form action> in the admin layout. Accepts FormData so Next.js
// can call it directly from a <form> in a Server Component.
export async function logoutAdmin(formData: FormData) {
  const locale = (formData.get("locale") as string) || "en";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/admin/login`);
}
