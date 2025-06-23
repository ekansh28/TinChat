/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // API Rewrites
  async rewrites() {
    return [
      {
        source: '/api/profiles/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/profiles/:path*`,
      },
    ];
  },

  // Environment Variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Headers (CSP + CORS)
  async headers() {
    const supabaseHostname = "tmxoylgtaexpldsvvqhv.supabase.co";
    const cdn = "https://cdn.sekansh21.workers.dev";

    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';
    const socketWsUrl = socketServerUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const socketWssUrl = socketServerUrl.replace('http://', 'wss://').replace('https://', 'wss://');

    const cspHeader = `
      default-src 'self' ${cdn};
      script-src 'self' 'unsafe-eval' 'unsafe-inline' ${cdn} *.paypal.com *.paypalobjects.com *.googleapis.com https://unpkg.com;
      style-src 'self' 'unsafe-inline' ${cdn} https://fonts.googleapis.com https://unpkg.com;
      font-src 'self' ${cdn} https://fonts.gstatic.com https://unpkg.com;
      img-src 'self' data: blob: *;
      media-src 'self' blob: *;
      connect-src 'self' ${cdn} ${socketServerUrl} ${socketWsUrl} ${socketWssUrl} ws://localhost:3000 ws://127.0.0.1:3000 ws://localhost:3001 ws://127.0.0.1:3001 wss://localhost:3001 wss://127.0.0.1:3001 wss://${supabaseHostname} https://${supabaseHostname} https://unpkg.com https://s3-us-east-2.amazonaws.com;
      frame-src 'self' ${cdn} *.youtube.com *.paypal.com;
      object-src 'self' ${cdn};
      worker-src 'self' ${cdn} blob:;
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
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

export default nextConfig;
<<<<<<< Updated upstream
=======

// hi
>>>>>>> Stashed changes
