import AdminSidebar from "@/components/admin/AdminSidebar";
import { createClient } from "@/utils/supabase/server";
import { logoutAdmin } from "@/app/actions/auth";
import { getCurrentAdminUser } from "@/lib/adminAuth";

type AdminLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No user means the middleware is sending them to /admin/login.
  // Render children bare (no sidebar) so the login page gets a clean full-screen layout.
  if (!user) {
    return <>{children}</>;
  }

  // Fetch the AdminUser record to get the role for sidebar filtering
  const adminUser = await getCurrentAdminUser();
  const userRole = adminUser?.role ?? "MANAGER";

  // The first character of the email as the avatar letter
  const avatarLetter = user.email?.charAt(0).toUpperCase() ?? "A";

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 font-english">
      {/* Sidebar */}
      <AdminSidebar locale={locale} userEmail={user.email ?? undefined} userRole={userRole} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header bar */}
        <header className="hidden lg:flex h-16 bg-white border-b border-gray-200 items-center justify-end px-8 shadow-sm gap-4">
          {/* User email */}
          <span className="text-sm font-medium text-gray-600">
            {user.email}
          </span>

          {/* Avatar */}
          <div className="w-9 h-9 bg-nassayem text-white rounded-full flex items-center justify-center font-bold text-sm select-none">
            {avatarLetter}
          </div>

          {/* Sign-out form — works from a Server Component via form action */}
          <form action={logoutAdmin}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors duration-200"
            >
              {isEn ? "Sign out" : "تسجيل الخروج"}
            </button>
          </form>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
