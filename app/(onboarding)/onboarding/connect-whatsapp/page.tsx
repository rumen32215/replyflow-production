import { redirect } from "next/navigation";

/**
 * WhatsApp is no longer part of the onboarding journey — connecting a
 * number happens later, from the dashboard's setup checklist ("Today's
 * Focus" surfaces "Connect WhatsApp" until it's done) and the dedicated
 * /dashboard/whatsapp page. The route itself is kept (old emails,
 * bookmarks, muscle memory) and simply forwards to the real home of
 * the feature. The Embedded Signup component was never deleted — see
 * components/dashboard/whatsapp-embedded-signup.tsx, still used by
 * app/(dashboard)/dashboard/whatsapp/page.tsx.
 */
export const dynamic = "force-dynamic";

export default function ConnectWhatsAppPage() {
  redirect("/dashboard/whatsapp");
}
