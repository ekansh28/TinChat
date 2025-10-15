// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import ClientLayout from "@/components/ClientLayout";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { SupabaseProvider } from "@/providers/SupabaseProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "TinChat",
  description: "Connect with someone new",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="google-adsense-account" content="ca-pub-5670235631357216" />
        <link rel="stylesheet" href="https://unpkg.com/98.css" crossOrigin="anonymous" />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <SupabaseProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="theme-98"
            enableSystem={false}
            storageKey="tinchat-theme"
          >
            <ClientLayout>{children}</ClientLayout>
          </ThemeProvider>
        </SupabaseProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
