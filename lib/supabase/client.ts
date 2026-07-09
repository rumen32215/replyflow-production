import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Use this inside Client Components
 * (anything with "use client") — auth forms, onboarding steps, etc.
 *
 * Deliberately does NOT throw on missing env vars, unlike the server
 * client. Next.js server-renders Client Components once too (to
 * produce the initial HTML), so `createClient()` called at the top of
 * a component body — the normal pattern used throughout this app —
 * executes on the server during that pass, including at build time
 * for any page Next attempts to statically prerender. A thrown error
 * here previously crashed the entire production build whenever env
 * vars weren't present at build time, which is a strictly worse
 * failure mode than a client that quietly can't reach Supabase until
 * actually used in the browser. If NEXT_PUBLIC_SUPABASE_URL/ANON_KEY
 * are genuinely missing in production, auth calls will fail at the
 * point they're used (visible in the browser console + surfaced via
 * the existing toast error handling in every form), which is enough
 * to diagnose without taking down the whole deployment.
 */
export function createClient() {
  // @supabase/ssr's createBrowserClient throws synchronously if either
  // value is falsy/empty — not just our own code. Falling back to
  // harmless placeholders (rather than "" or undefined) means
  // construction always succeeds; when real env vars are present (any
  // correctly configured deployment) these fallbacks are never used,
  // so behavior is identical to before. This only changes what happens
  // in the previously-crashing case of genuinely missing env vars.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. " +
        "Auth and data calls will fail until these are configured."
    );
  }

  return createBrowserClient(url, anonKey);
}
