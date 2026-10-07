import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const isCloudflareBuild = process.env.INSUREIT_CLOUDFLARE_BUILD === "1";
function configuredOrigin(value) {
  try {
    return value ? new URL(value).origin : "";
  } catch {
    return "";
  }
}

const supabaseOrigin = configuredOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self' https://www.icallinsurance.com",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${supabaseOrigin}${process.env.NODE_ENV === "production" ? "" : " ws: wss:"}`.trim(),
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : [])
].join("; ");

const embeddedEditorContentSecurityPolicy = contentSecurityPolicy.replace("frame-ancestors 'none'", "frame-ancestors 'self'");

const firebaseOtpTestContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
  "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "frame-src 'self' https://www.google.com https://www.recaptcha.net https://insureit-customer-auth.firebaseapp.com",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google.com https://www.recaptcha.net https://www.gstatic.com",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : [])
].join("; ");

const firebaseOtpTestHeaders = [
  { key: "Content-Security-Policy", value: firebaseOtpTestContentSecurityPolicy },
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : [])
];

const voiceLabHeaders = [
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
];

const embeddedEditorHeaders = [
  { key: "Content-Security-Policy", value: embeddedEditorContentSecurityPolicy },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  // Cloudflare staging has no Images binding. Disable Next image optimization only there.
  images: {
    unoptimized: isCloudflareBuild,
  },
  transpilePackages: ["@insureit/claim-journey"],
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/firebase-otp-test/:path*",
        headers: firebaseOtpTestHeaders,
      },
      {
        source: "/partner/renewals/voice-lab",
        headers: voiceLabHeaders,
      },
      {
        source: "/customers/:id/edit",
        has: [{ type: "query", key: "embedded", value: "1" }],
        headers: embeddedEditorHeaders,
      },
      {
        source: "/vehicles/:id/edit",
        has: [{ type: "query", key: "embedded", value: "1" }],
        headers: embeddedEditorHeaders,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "25mb"
    }
  }
};

export default nextConfig;
