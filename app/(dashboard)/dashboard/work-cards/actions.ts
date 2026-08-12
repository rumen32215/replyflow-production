"use server";

import { revalidatePath } from "next/cache";

/**
 * Production hardening — a real bug found in live testing: creating a
 * Work Card from a Conversation writes directly via the client Supabase
 * session (conversation-story.tsx's saveJob), which has no way to tell
 * Next.js that /dashboard/work-cards' own cached data is now stale.
 * The App Router's client-side Router Cache serves a dynamic route's
 * last-fetched payload for up to 30s after a visit — long enough that
 * navigating straight from "job created" to Work Cards could show an
 * empty or outdated list until a hard reload bypassed the cache. This
 * is the one thing a client component genuinely cannot do itself
 * (revalidatePath is server-only); saveJob calls this immediately after
 * a successful insert, in addition to its own router.refresh().
 */
export async function revalidateWorkCards() {
  revalidatePath("/dashboard/work-cards");
}
