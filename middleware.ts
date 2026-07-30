import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/verify-email"];

/**
 * Refreshes the Supabase session on every request and gates the two
 * areas that require an authenticated user: /onboarding and (later)
 * /dashboard. Unauthenticated visitors hitting a protected path are
 * bounced to /login; authenticated visitors hitting an auth page are
 * bounced to / (which then routes them onward — see app/page.tsx).
 */
export async function middleware(request: NextRequest) {
  // Master Execution Plan 3.1 — the dashboard layout needs to know the
  // current path (to exempt /dashboard/settings from the subscription
  // gate, so a blocked owner can always reach billing to fix it), and
  // Server Components have no built-in way to read it. Passing it
  // through as a request header is the standard, documented way to
  // make it available to next/headers() downstream.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isProtectedPath = path.startsWith("/onboarding") || path.startsWith("/dashboard");

  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
