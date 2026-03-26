import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import InviteUserForm from "@/components/admin/InviteUserForm";
import DeleteUserButton from "@/components/admin/DeleteUserButton";
import { format } from "date-fns";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminUsersPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  // Get logged-in user to mark "You" and block self-deletion in the UI
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const adminUsers = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Admin Users" : "المستخدمون"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? "Manage who has access to this admin panel."
              : "إدارة من يملك صلاحية الوصول إلى لوحة التحكم."}
          </p>
        </div>

        <InviteUserForm locale={locale} />
      </div>

      {/* How invitations work — info box */}
      <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
        <svg className="w-5 h-5 shrink-0 mt-0.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {isEn
            ? "Invited users receive an email with a link to set their password. Once set, they can sign in at the admin login page."
            : "يتلقى المستخدمون المدعوون بريداً إلكترونياً لتعيين كلمة المرور. بعد ذلك يمكنهم تسجيل الدخول."}
        </span>
      </div>

      {/* Users list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {adminUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isEn ? "No admin users yet" : "لا يوجد مستخدمون بعد"}
            </h3>
            <p className="text-gray-500 text-sm max-w-xs">
              {isEn
                ? "Invite your first team member to give them admin access."
                : "ادعُ أول عضو في فريقك لمنحه صلاحية الوصول."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {adminUsers.map((adminUser) => {
              const isSelf = adminUser.supabaseId === currentUser?.id;
              const initials = (adminUser.name ?? adminUser.email)
                .charAt(0)
                .toUpperCase();

              return (
                <li key={adminUser.id} className="flex items-center gap-4 px-4 md:px-6 py-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-nassayem/10 text-nassayem rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {adminUser.name ?? adminUser.email}
                      </span>
                      {isSelf && (
                        <span className="text-xs bg-nassayem/10 text-nassayem px-2 py-0.5 rounded-full font-semibold">
                          {isEn ? "You" : "أنت"}
                        </span>
                      )}
                    </div>
                    {adminUser.name && (
                      <p className="text-xs text-gray-400 mt-0.5">{adminUser.email}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isEn ? "Added " : "أُضيف "}
                      {format(new Date(adminUser.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>

                  {/* Delete — hidden for self */}
                  {!isSelf && (
                    <DeleteUserButton
                      adminUserId={adminUser.id}
                      supabaseId={adminUser.supabaseId}
                      locale={locale}
                      isEn={isEn}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
