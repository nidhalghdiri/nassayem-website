"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/app/actions/auth";

type Props = {
  locale: string;
};

const initialState = { error: null };

export default function AdminLoginForm({ locale }: Props) {
  const isEn = locale === "en";
  const [state, formAction, isPending] = useActionState(
    loginAdmin,
    initialState,
  );

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-wide">
            {isEn ? "Nassayem " : "نسائم "}
            <span className="text-nassayem">{isEn ? "Admin" : "للإدارة"}</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {isEn ? "Sign in to manage properties and bookings" : "سجّل دخولك لإدارة العقارات والحجوزات"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-8">
          <form action={formAction} className="space-y-5">
            {/* Hidden locale so the server action knows where to redirect */}
            <input type="hidden" name="locale" value={locale} />

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                {isEn ? "Email address" : "البريد الإلكتروني"}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isPending}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem focus:border-transparent transition disabled:opacity-60"
                placeholder={isEn ? "you@example.com" : "example@email.com"}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                {isEn ? "Password" : "كلمة المرور"}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem focus:border-transparent transition disabled:opacity-60"
                placeholder="••••••••"
              />
            </div>

            {/* Error message */}
            {state?.error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {state.error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 px-4 bg-nassayem hover:bg-nassayem-dark text-white font-semibold rounded-xl transition-colors duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isEn ? "Signing in…" : "جارٍ تسجيل الدخول…"}
                </>
              ) : (
                isEn ? "Sign in" : "تسجيل الدخول"
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-gray-600">
          {isEn
            ? "Access is restricted to authorised administrators only."
            : "الوصول مقتصر على المشرفين المخوّلين فقط."}
        </p>
      </div>
    </div>
  );
}
