"use client";

import { useActionState, useState } from "react";
import { inviteAdminUser } from "@/app/actions/users";

const initialState = { error: null, success: null };

type Props = { locale: string };

export default function InviteUserForm({ locale }: Props) {
  const isEn = locale === "en";
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    inviteAdminUser,
    initialState,
  );

  // Close form on success
  const showForm = open && !state?.success;

  return (
    <div>
      {/* Success banner */}
      {state?.success && (
        <div className="mb-4 flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{state.success}</span>
        </div>
      )}

      {/* Toggle button */}
      {!showForm && (
        <button
          onClick={() => { setOpen(true); }}
          className="flex items-center gap-2 bg-nassayem text-white hover:bg-nassayem-dark px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          {isEn ? "Invite User" : "دعوة مستخدم"}
        </button>
      )}

      {/* Inline invite form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 max-w-md">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">
              {isEn ? "Invite a new admin" : "دعوة مشرف جديد"}
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {isEn ? "Name (optional)" : "الاسم (اختياري)"}
              </label>
              <input
                name="name"
                type="text"
                disabled={isPending}
                placeholder={isEn ? "e.g. Mohammed Al-Rashdi" : "مثال: محمد الرشدي"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem focus:border-transparent transition disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {isEn ? "Email address" : "البريد الإلكتروني"}
              </label>
              <input
                name="email"
                type="email"
                required
                disabled={isPending}
                placeholder={isEn ? "admin@example.com" : "admin@example.com"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem focus:border-transparent transition disabled:opacity-60"
              />
            </div>

            {state?.error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {state.error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-nassayem text-white hover:bg-nassayem-dark px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {isEn ? "Sending…" : "جارٍ الإرسال…"}
                  </>
                ) : (
                  isEn ? "Send Invitation" : "إرسال الدعوة"
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {isEn ? "Cancel" : "إلغاء"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
