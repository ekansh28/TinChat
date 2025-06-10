// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

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
          href="https://unpkg.com/98.css@0.1.21/dist/98.css"
          crossOrigin="anonymous"
        />
        <link 
          rel="stylesheet" 
          href="https://unpkg.com/7.css@0.1.2/dist/7.css"
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
      </body>
    </html>
  );
}