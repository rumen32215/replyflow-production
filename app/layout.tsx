import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { PageTransitionProvider } from "@/components/shared/page-transition";
import { ReceptionistRevealProvider } from "@/components/shared/receptionist-reveal";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * V17 founder review (2026-08-04) — release-candidate audit: no page
 * had `openGraph`/`twitter` metadata at all, so any link shared to
 * WhatsApp, Slack, Twitter/X or LinkedIn rendered as bare text with no
 * card. `metadataBase` plus `openGraph`/`twitter` here give every page
 * a sane default (individual routes, e.g. `app/page.tsx`, already
 * override `title`/`description` and inherit the rest). The actual
 * share image comes from `app/opengraph-image.tsx` (generated from the
 * existing brand mark, not a new design asset).
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://replyflow-production.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "ReplyFlow — Never miss another customer",
  description:
    "The front desk for service businesses. Your receptionist answers every customer while you're on the tools.",
  openGraph: {
    title: "ReplyFlow — Never miss another customer",
    description: "The front desk for service businesses. Your receptionist answers every customer while you're on the tools.",
    siteName: "ReplyFlow",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReplyFlow — Never miss another customer",
    description: "The front desk for service businesses. Your receptionist answers every customer while you're on the tools.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        {/* V17 founder review (2026-08-04) — release-candidate audit:
         * this was the one real accessibility gap across an otherwise
         * carefully-considered, heavily-animated experience — nothing
         * anywhere respected `prefers-reduced-motion` except a single
         * CSS block scoped to the aurora blobs. `reducedMotion="user"`
         * is Framer Motion's own built-in fix for exactly this: every
         * `motion.*` component in the tree automatically drops
         * transform/layout animation (the floating, breathing,
         * shimmer-sweep, spark-burst kind) down to a simple opacity
         * fade when the visitor's OS says they prefer reduced motion —
         * content still reveals, nothing breaks, one change instead of
         * touching every animate prop in every file. */}
        <MotionConfig reducedMotion="user">
          <PageTransitionProvider>
            <ReceptionistRevealProvider>{children}</ReceptionistRevealProvider>
          </PageTransitionProvider>
          <Toaster />
        </MotionConfig>
      </body>
    </html>
  );
}
