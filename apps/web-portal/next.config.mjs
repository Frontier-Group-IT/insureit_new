import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  }
};

export default nextConfig;
