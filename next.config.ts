import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Static CSP (no nonces: they'd force dynamic rendering of the shell). Scripts need
 * 'unsafe-inline' for Next's inline payloads, so the main defence for article HTML is the
 * server-side allowlist sanitiser (core/extract/sanitize). This header narrows everything else:
 * only YouTube/Vimeo frames, no plugins, no foreign forms/base, not frameable, and http images
 * are upgraded to https.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  // Login/logout redirect to Auth0 via navigation, not form posts.
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // linkedom has an optional `canvas` require; keep these as runtime Node modules.
  serverExternalPackages: ["linkedom", "@mozilla/readability"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
