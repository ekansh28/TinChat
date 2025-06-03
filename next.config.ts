
import type {NextConfig} from 'next';

const NEXT_PUBLIC_SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'https://chat-g145.onrender.com';
const socketServerHostname = new URL(NEXT_PUBLIC_SOCKET_SERVER_URL).hostname;

// Dynamically determine Supabase hostname if URL is set
let supabaseHostname = '';
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch (e) {
    console.error("Invalid NEXT_PUBLIC_SUPABASE_URL for CSP:", e);
  }
}


const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com/firebasejs/ https://static.cloudflareinsights.com https://www.googletagmanager.com;
    style-src 'self' 'unsafe-inline' https://unpkg.com;
    img-src 'self' data: https://placehold.co https://github.com https://storage.googleapis.com ${supabaseHostname ? supabaseHostname : ''};
    font-src 'self' https://unpkg.com;
    connect-src 'self' ${NEXT_PUBLIC_SOCKET_SERVER_URL} wss://${socketServerHostname} *.google.com *.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com https://www.google-analytics.com https://ssl.google-analytics.com https://analytics.google.com ${supabaseHostname ? `https://${supabaseHostname} wss://${supabaseHostname}` : ''};
    frame-src 'self' ${supabaseHostname ? `https://${supabaseHostname}` : ''};
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://studio.firebase.google.com;
    frame-ancestors 'self' https://studio.firebase.google.com;
    upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();


const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Add Supabase storage hostname if needed for images
      // For example, if supabaseHostname is xyz.supabase.co
      // {
      //   protocol: 'https',
      //   hostname: supabaseHostname, // Dynamically set
      //   port: '',
      //   pathname: '/storage/v1/object/public/**', // Adjust path as needed
      // },
    ],
  },
  env: {
    NEXT_PUBLIC_SOCKET_SERVER_URL: NEXT_PUBLIC_SOCKET_SERVER_URL,
    // NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are read from .env automatically
  },
  async headers() {
    return [
      {
        source: '/(.*)', // Apply to all routes
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY', 
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: "camera=(self), microphone=(self), fullscreen=(self), display-capture=(self), autoplay=(self)",
          }
        ],
      },
    ];
  },
};

export default nextConfig;
