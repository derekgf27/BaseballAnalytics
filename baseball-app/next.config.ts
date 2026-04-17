import type { NextConfig } from "next";
import { SHORTLINK_REDIRECTS } from "./src/lib/routeRedirects";

const nextConfig: NextConfig = {
  /** Keep the in-browser dev bubble visible (compiling / rendering); do not use `false` here. */
  devIndicators: {
    position: "bottom-right",
  },
  async redirects() {
    return SHORTLINK_REDIRECTS;
  },
};

export default nextConfig;
