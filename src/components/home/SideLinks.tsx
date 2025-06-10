// src/components/home/SideLinks.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import styles from '@/styles/page.module.css';

interface SideLinksProps {
  isMobile: boolean;
}

export default function SideLinks({ isMobile }: SideLinksProps) {
  return (
    <>
      {/* Discord Link - Left side of card */}
      <Link 
        href="https://discord.gg/gayporn" 
        target="_blank" 
        rel="noopener noreferrer"
        className={cn(
          styles.sideLinkLeft,
          isMobile && "!left-[-2.5rem]" // Override for mobile
        )}
      >
        <Image
          src="/icons/discord.gif"
          alt="discord"
          width={isMobile ? 32 : 88}
          height={isMobile ? 32 : 31}
         
        />
      </Link>

      {/* Donate Link - Right side of card */}
      <Link 
        href="https://paypal.me/ekansh32" 
        target="_blank" 
        rel="noopener noreferrer"
        className={cn(
          styles.sideLinkRight,
          isMobile && "!right-[-2.5rem]" // Override for mobile
        )}
      >
        <Image
          src="/icons/donate.png"
          alt="donate"
          width={isMobile ? 32 : 88}
          height={isMobile ? 32 : 31}
        />
      </Link>
    </>
  );
}