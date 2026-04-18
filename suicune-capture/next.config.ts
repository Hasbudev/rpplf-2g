import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // basePath: "/rpplf-2g",
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;