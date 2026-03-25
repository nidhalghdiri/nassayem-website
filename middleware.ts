import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const locales = ["en", "ar"];
const defaultLocale = "en";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. i18n: redirect to default locale if none present ────────────────
  const pathnameHasLocale = locales.some(
    (locale) =>
      pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (!pathnameHasLocale) {
    request.nextUrl.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // ── 2. Supabase session refresh (must happen on every request) ──────────
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() refreshes the token and returns the authenticated user (or null).
  // Do NOT use getSession() here — it is not reliable in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── 3. Admin route protection ───────────────────────────────────────────
  const locale =
    locales.find(
      (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`,
    ) ?? defaultLocale;

  const isAdminRoute = pathname.startsWith(`/${locale}/admin`);
  const isLoginPage = pathname.startsWith(`/${locale}/admin/login`);

  // Unauthenticated on a protected admin route → send to login
  if (isAdminRoute && !isLoginPage && !user) {
    request.nextUrl.pathname = `/${locale}/admin/login`;
    return NextResponse.redirect(request.nextUrl);
  }

  // Already authenticated but visiting login → send to dashboard
  if (isLoginPage && user) {
    request.nextUrl.pathname = `/${locale}/admin`;
    return NextResponse.redirect(request.nextUrl);
  }

  return response;
}

export const config = {
  // Skip static files, API routes, and Next.js internals
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
