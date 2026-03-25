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

  // ── 2. Clone request headers and add x-pathname so Server Components
  //       (e.g. the root layout) can detect the current route ────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // ── 3. Supabase session refresh ─────────────────────────────────────────
  // We create the initial response with the modified request headers so
  // x-pathname is preserved even if setAll re-creates the response object.
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
          // Always pass requestHeaders so x-pathname is not lost
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

  // getUser() refreshes the token. Do NOT use getSession() in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── 4. Admin route protection ───────────────────────────────────────────
  const locale =
    locales.find(
      (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`,
    ) ?? defaultLocale;

  const isAdminRoute = pathname.startsWith(`/${locale}/admin`);
  const isLoginPage = pathname.startsWith(`/${locale}/admin/login`);

  if (isAdminRoute && !isLoginPage && !user) {
    request.nextUrl.pathname = `/${locale}/admin/login`;
    return NextResponse.redirect(request.nextUrl);
  }

  if (isLoginPage && user) {
    request.nextUrl.pathname = `/${locale}/admin`;
    return NextResponse.redirect(request.nextUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
