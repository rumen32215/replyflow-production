import { redirect } from "next/navigation";

/**
 * Business Profile grew into the Business memory experience at
 * /dashboard/business. Route kept so old links keep working.
 */
export const dynamic = "force-dynamic";

export default function LegacyBusinessProfilePage() {
  redirect("/dashboard/business");
}
