import type { NextConfig } from "next";
import { getBasePath } from "./src/constants/deployment";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: getBasePath(),
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
