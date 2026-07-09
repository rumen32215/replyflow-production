import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Check that NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local, then restart `npm run dev` " +
        "(Next.js only reads .env files at startup)."
    );
  }
  return { url, anonKey };
}

/**
 * Server-side Supabase client. Use this inside Server Components,
 * Route Handlers, and Server Actions — never import this into a
 * "use client" file.
 */
export function createClient() {
  const { url, anonKey } = getEnv();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component — safe to ignore because
          // middleware.ts refreshes the session on every request.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Same as above.
        }
      },
    },
  });
}
