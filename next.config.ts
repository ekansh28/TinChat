/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    const supabaseHostname = "tmxoylgtaexpldsvvqhv.supabase.co";
    const cdn = "https://cdn.sekansh21.workers.dev";
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'https://chat.tinchat.online';
    const socketWsUrl = socketServerUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const socketWssUrl = socketServerUrl.replace('http://', 'wss://').replace('https://', 'wss://');

    const cspHeader = `
      default-src 'self' ${cdn};
      script-src 'self' 'unsafe-eval' 'unsafe-inline' ${cdn}
        https://*.paypal.com https://*.paypalobjects.com
        https://*.googleapis.com https://unpkg.com
        https://static.cloudflareinsights.com https://cdn.jsdelivr.net
        https://*.clerk.accounts.dev;
      script-src-elem 'self' 'unsafe-inline' ${cdn}
        https://*.paypal.com https://*.paypalobjects.com
        https://*.googleapis.com https://unpkg.com
        https://static.cloudflareinsights.com https://cdn.jsdelivr.net
        https://*.clerk.accounts.dev;
      style-src 'self' 'unsafe-inline' ${cdn} https://fonts.googleapis.com https://unpkg.com;
      font-src 'self' ${cdn} https://fonts.gstatic.com https://unpkg.com;
      img-src 'self' data: blob: *;
      media-src 'self' blob: *;
      connect-src 'self'
        ${cdn} ${socketServerUrl} ${socketWsUrl} ${socketWssUrl}
        https://${supabaseHostname} wss://${supabaseHostname}
        https://*.clerk.accounts.dev https://clerk-telemetry.com
        https://unpkg.com https://s3-us-east-2.amazonaws.com
        https://static.cloudflareinsights.com;
      frame-src 'self' ${cdn} https://*.youtube.com https://*.paypal.com;
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

export default nextConfig;
