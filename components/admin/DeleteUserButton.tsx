"use client";

import { deleteAdminUser } from "@/app/actions/users";

type Props = {
  adminUserId: string;
  supabaseId: string;
  locale: string;
  isEn: boolean;
};

export default function DeleteUserButton({
  adminUserId,
  supabaseId,
  locale,
  isEn,
}: Props) {
  return (
    <form
      action={deleteAdminUser}
      onSubmit={(e) => {
        if (
          !confirm(
            isEn
              ? "Remove this user's admin access?"
              : "هل تريد إزالة صلاحية هذا المستخدم؟",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="adminUserId" value={adminUserId} />
      <input type="hidden" name="supabaseId" value={supabaseId} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
          />
        </svg>
        {isEn ? "Remove" : "إزالة"}
      </button>
    </form>
  );
}
