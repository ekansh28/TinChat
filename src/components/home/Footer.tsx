// src/components/home/Footer.tsx
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import styles from '@/styles/page.module.css';

interface FooterProps {
  isMobile: boolean;
}

export default function Footer({ isMobile }: FooterProps) {
  return (
    <footer className={cn(
      styles.homeFooter,
      isMobile && "py-3"
    )}>
      <div className="max-w-5xl mx-auto">
        <div className={styles.footerDivider}></div>
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