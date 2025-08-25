// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import ClientLayout from "@/components/ClientLayout"; // ✅ New client wrapper

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
    <ClerkProvider>
      <html lang="en">
        <head>
          <meta name="google-adsense-account" content="ca-pub-5670235631357216" />
          <link rel="stylesheet" href="https://unpkg.com/98.css" crossOrigin="anonymous" />
        </head>
        <body className={inter.className} suppressHydrationWarning={true}>
          <ThemeProvider
            attribute="class"
            defaultTheme="theme-98"
            enableSystem={false}
            storageKey="tinchat-theme"
          >
            <ClientLayout>{children}</ClientLayout> {/* ✅ Wrap here */}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
