import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from "@/lib/authSession";

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

  // ── 2. Clone request headers and add x-pathname so Server Components
  //       (e.g. the root layout) can detect the current route ────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ── 3. Supabase session refresh (optional / fail-safe) ─────────────────
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value),
              );
              response = NextResponse.next({
                request: { headers: requestHeaders },
              });
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options),
              );
            },
          },
        },
      );
      // Soft touch - do not block on failure
      await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    } catch {
      // Ignore Supabase connection or quota issues in middleware
    }
  }

  // ── 4. Admin route protection via Direct JWT Session Cookie ───────────
  const locale =
    locales.find(
      (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`,
    ) ?? defaultLocale;

  const isAdminRoute = pathname.startsWith(`/${locale}/admin`);
  const isLoginPage = pathname.startsWith(`/${locale}/admin/login`);

  if (isAdminRoute) {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME);
    const adminSession = await verifyAdminSessionToken(sessionCookie?.value);

    if (!isLoginPage && !adminSession) {
      request.nextUrl.pathname = `/${locale}/admin/login`;
      return NextResponse.redirect(request.nextUrl);
    }

    if (isLoginPage && adminSession) {
      request.nextUrl.pathname = `/${locale}/admin`;
      return NextResponse.redirect(request.nextUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
