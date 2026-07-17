import { redirect } from "next/navigation";

/**
 * "AI Receptionist" is retired language (Decision 001: no AI
 * terminology). The experience now lives at /dashboard/receptionist;
 * this route survives only so old links and muscle memory keep working.
 */
export const dynamic = "force-dynamic";

export default function LegacyAiReceptionistPage() {
  redirect("/dashboard/receptionist");
}
