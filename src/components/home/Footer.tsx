// src/components/home/Footer.tsx
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface FooterProps {
  isMobile: boolean;
}

export default function Footer({ isMobile }: FooterProps) {
  return (
    <footer className={cn(
      "mt-auto py-4 text-center relative z-10",
      isMobile && "py-3"
    )}>
      <div className="max-w-5xl mx-auto">
        <div className="border-t-2 border-gray-300 dark:border-gray-600 my-4 w-full"></div>
      </div>
      <p className={cn(
        "text-gray-500 dark:text-gray-400",
        isMobile ? "text-xs space-y-1 flex flex-col" : "text-sm space-x-2"
      )}>
        {isMobile ? (
          <>
            <span>tinchat.online</span>
            <span className="space-x-2">
              <Link href="/rules" className="text-red-600 hover:underline">Rules</Link>
              <span>•</span>
              <Link href="/terms" className="text-red-600 hover:underline">Terms</Link>
              <span>•</span>
              <Link href="/privacy" className="text-red-600 hover:underline">Privacy</Link>
            </span>
          </>
        ) : (
          <>
            <span>tinchat.online</span>
            <span>•</span>
            <Link href="/rules" className="text-red-600 hover:underline">Rules</Link>
            <span>•</span>
            <Link href="/terms" className="text-red-600 hover:underline">Terms Of Service</Link>
            <span>•</span>
            <Link href="/privacy" className="text-red-600 hover:underline">Privacy</Link>
          </>
        )}
      </p>
    </footer>
  );
}