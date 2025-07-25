import {withSentryConfig} from '@sentry/nextjs';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Add images configuration for external domains
  images: {
    domains: [
      'img.clerk.com', // Clerk user avatars
      'cdn.tinchat.online', // Your existing CDN
      'images.unsplash.com', // If you use Unsplash images
      'pub-8cff6f1c23f942768d1416616d15d6f0.r2.dev' // Add this line
      // 'files.yourdomain.com', 
    ],
  },

  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucnkpbrmjelpqopncqhc.supabase.co';
    const supabaseHostname = new URL(supabaseUrl).hostname;

    const cdn = "https://cdn.tinchat.online";
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'https://chat.tinchat.online';
    const socketWsUrl = socketServerUrl.replace('http://', 'ws://').replace('https://', 'wss://');

    const cspHeader = `
      default-src 'self' ${cdn};
      script-src 'self' 'unsafe-eval' 'unsafe-inline' ${cdn}
        https://*.paypal.com https://*.paypalobjects.com
        https://*.googleapis.com https://unpkg.com
        https://static.cloudflareinsights.com https://cdn.jsdelivr.net
        https://*.clerk.accounts.dev https://challenges.cloudflare.com;
      script-src-elem 'self' 'unsafe-inline' ${cdn}
        https://*.paypal.com https://*.paypalobjects.com
        https://*.googleapis.com https://unpkg.com
        https://static.cloudflareinsights.com https://cdn.jsdelivr.net
        https://*.clerk.accounts.dev https://challenges.cloudflare.com;
      style-src 'self' 'unsafe-inline' ${cdn} https://fonts.googleapis.com https://unpkg.com;
      font-src 'self' ${cdn} https://fonts.gstatic.com https://unpkg.com;
      img-src 'self' data: blob: *;
      media-src 'self' blob: *;
      connect-src 'self'
        ${cdn} ${socketServerUrl} ${socketWsUrl}
        https://${supabaseHostname} wss://${supabaseHostname}
        wss://chat.tinchat.online
        https://*.clerk.accounts.dev https://clerk-telemetry.com
        https://unpkg.com https://s3-us-east-2.amazonaws.com
        https://static.cloudflareinsights.com;
      frame-src 'self' ${cdn} https://*.youtube.com https://*.paypal.com https://challenges.cloudflare.com;
      object-src 'none';
      worker-src 'self' ${cdn} blob:;
      manifest-src 'self' ${cdn};
      base-uri 'self';
    `.replace(/\n/g, ' ').trim();

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

export default withSentryConfig(nextConfig, {
// For all available options, see:
// https://www.npmjs.com/package/@sentry/webpack-plugin#options

org: "tinchat",
project: "javascript-nextjs",

// Only print logs for uploading source maps in CI
silent: !process.env.CI,

// For all available options, see:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

// Upload a larger set of source maps for prettier stack traces (increases build time)
widenClientFileUpload: true,

// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
// This can increase your server load as well as your hosting bill.
// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
// side errors will fail.
tunnelRoute: "/monitoring",

// Automatically tree-shake Sentry logger statements to reduce bundle size
disableLogger: true,

// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
// See the following for more information:
// https://docs.sentry.io/product/crons/
// https://vercel.com/docs/cron-jobs
automaticVercelMonitors: true,
});