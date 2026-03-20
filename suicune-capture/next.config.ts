import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: "/suicune-rpplf",
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;