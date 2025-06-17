/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const supabaseHostname = "tmxoylgtaexpldsvvqhv.supabase.co";
    const cdn = "https://cdn.sekansh21.workers.dev";
    
    // Socket.IO server configuration
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';
    const socketWsUrl = socketServerUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const socketWssUrl = socketServerUrl.replace('http://', 'wss://').replace('https://', 'wss://');

    const cspHeader = `
      default-src 'self' ${cdn};
      script-src 'self' 'unsafe-eval' 'unsafe-inline' ${cdn} *.paypal.com *.paypalobjects.com *.googleapis.com https://unpkg.com;
      style-src 'self' 'unsafe-inline' ${cdn} https://fonts.googleapis.com https://unpkg.com;
      font-src 'self' ${cdn} https://fonts.gstatic.com https://unpkg.com;
      img-src 'self' data: ${cdn} https://placehold.co https://github.com https://storage.googleapis.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://*.paypalobjects.com https://unpkg.com https://cdn.jsdelivr.net ${supabaseHostname} https://s3-us-east-2.amazonaws.com;
      media-src 'self' ${cdn} https://s3-us-east-2.amazonaws.com;
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
    ];
  },
};

export default nextConfig;
// This configuration sets up a Content Security Policy (CSP) for a Next.js application.
// The CSP restricts various types of content to specific sources, enhancing security by preventing cross-site scripting (XSS) and other code injection attacks.
// ✅ SOCKET.IO NOW WORKING: Added Socket.IO server URLs in connect-src
// ✅ FONTS FIXED: Added https://unpkg.com to font-src for 98.css fonts
// ✅ WEBAMP FIXED: Added https://s3-us-east-2.amazonaws.com for butterchurn presets