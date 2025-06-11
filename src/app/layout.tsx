// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import Script from 'next/script';

const inter = Inter({ subsets: ["latin"] });

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
        {/* Load 98.css and 7.css from CDN */}
        <link 
          rel="stylesheet" 
          href="https://unpkg.com/98.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="theme-98"
          enableSystem={false}
          storageKey="tinchat-theme"
        >
          {children}
        </ThemeProvider>
        
    
        {/* Load animated cursor script */}
        <Script 
          src="/animated-cursor.js" 
          strategy="beforeInteractive"
          id="animated-cursor-script"
        />
        
        {/* Optional: Load oneko script if you want it always available */}
        <Script 
          src="/oneko.js" 
          strategy="lazyOnload"
          id="oneko-script"
        />
      </body>
    </html>
  );
}