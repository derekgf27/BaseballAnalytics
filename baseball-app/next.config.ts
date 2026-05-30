import type { NextConfig } from "next";
import { SHORTLINK_REDIRECTS } from "./src/lib/routeRedirects";

const nextConfig: NextConfig = {
  /** Keep the in-browser dev bubble visible (compiling / rendering); do not use `false` here. */
  devIndicators: {
    position: "bottom-right",
  },
  experimental: {
    optimizePackageImports: [
      "recharts",
      "framer-motion",
      "date-fns",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "react-day-picker",
      "jspdf",
      "jspdf-autotable",
      "react-to-print",
      "@supabase/supabase-js",
    ],
  },
  async redirects() {
    return SHORTLINK_REDIRECTS;
  },
};

export default nextConfig;
