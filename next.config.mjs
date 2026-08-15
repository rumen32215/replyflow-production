/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  // ReplyFlow 2.0, Phase 2D — @react-pdf/renderer 4.x ships as pure
  // ESM; without this, Next's webpack build externalizes it and tries
  // to require() it, which fails ("ESM packages need to be imported").
  // transpilePackages runs it through webpack properly instead —
  // needed for the customer-facing report preview
  // (components/dashboard/reports/report-preview.tsx) and the
  // future server-side PDF generation stage that will reuse the same
  // lib/job-docs/report-document.tsx.
  transpilePackages: ["@react-pdf/renderer"],
};

export default nextConfig;
