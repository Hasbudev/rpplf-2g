import type { NextConfig } from "next";

const repo = process.env.NEXT_PUBLIC_BASE_PATH ?? ""; // e.g. "/my-repo"



const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: repo,
  assetPrefix: repo,
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;