/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const supabaseHostname = "tmxoylgtaexpldsvvqhv.supabase.co";
    const cdn = "https://cdn.sekansh21.workers.dev";

    const cspHeader = `
      default-src 'self' ${cdn};
      script-src 'self' 'unsafe-eval' 'unsafe-inline' ${cdn} *.paypal.com *.paypalobjects.com *.googleapis.com;
      style-src 'self' 'unsafe-inline' ${cdn} https://fonts.googleapis.com;
      font-src 'self' ${cdn} https://fonts.gstatic.com;
      img-src 'self' data: ${cdn} https://placehold.co https://github.com https://storage.googleapis.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://*.paypalobjects.com https://unpkg.com https://cdn.jsdelivr.net ${supabaseHostname};
      media-src 'self' ${cdn};
      connect-src 'self' ${cdn} ws://localhost:3000 ws://127.0.0.1:3000 wss://${supabaseHostname} https://${supabaseHostname};
      frame-src 'self' ${cdn} *.youtube.com *.paypal.com;
      object-src 'self' ${cdn};
      worker-src 'self' ${cdn};
      manifest-src 'self' ${cdn};
      base-uri 'self';
    `.replace(/\s{2,}/g, " ").trim();

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
// This configuration sets up a Content Security Policy (CSP) for a Next.js application.
// The CSP restricts various types of content to specific sources, enhancing security by preventing cross-site scripting (XSS) and other code injection attacks.