import { createServerClient } from "@supabase/ssr";
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
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror onto the incoming request too (not just the
          // response) — @supabase/ssr's own documented pattern, so a
          // refreshed session is visible to any code in this same
          // request that reads request.cookies after this point, not
          // just to the browser on the next request. Rebuilding
          // `response` here must keep the x-pathname header set above
          // — losing it would silently break the dashboard layout's
          // subscription-gate exemption for /dashboard/settings.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));
  // Master Execution Plan 3.3 — /admin needs a real authenticated
  // session at minimum (defence in depth, before the request even
  // reaches app/admin/layout.tsx); the actual admin-allowlist check
  // happens there, not here, since it needs a real DB-adjacent lookup
  // (lib/admin.ts) that's simpler to keep out of the edge runtime.
  const isProtectedPath = path.startsWith("/onboarding") || path.startsWith("/dashboard") || path.startsWith("/admin");

  // Production hardening (2026-08-14) — mobile auth bug, root cause: no
  // response here ever set Cache-Control, so mobile Safari/Chrome could
  // restore a full previous page (DOM and all) straight from the
  // back/forward cache on navigation or app resume — zero network
  // request, this middleware never runs, an already-signed-out or
  // already-switched-account browser silently shows the stale page.
  // Scoped to auth-sensitive paths only, never the public marketing
  // pages, which should stay normally cacheable.
  if (isProtectedPath || isPublicPath) {
    response.headers.set("Cache-Control", "no-store");
  }

  if (!user && isProtectedPath) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  }
  if (user && isPublicPath) {
    const redirect = NextResponse.redirect(new URL("/", request.url));
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
