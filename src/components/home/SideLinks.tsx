// src/components/home/SideLinks.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

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
          "absolute z-10 transition-transform hover:scale-110",
          isMobile 
            ? "left-2 top-1/2 transform -translate-y-1/2" 
            : "left-0 top-1/2 transform -translate-y-1/2 -translate-x-16"
        )}
      >
        <Image
          src="/icons/discord.gif"
          alt="discord"
          width={isMobile ? 32 : 40}
          height={isMobile ? 32 : 40}
          className="transition-opacity hover:opacity-80"
        />
      </Link>

      {/* Donate Link - Right side of card */}
      <Link 
        href="https://paypal.me/ekansh32" 
        target="_blank" 
        rel="noopener noreferrer"
        className={cn(
          "absolute z-10 transition-transform hover:scale-110",
          isMobile 
            ? "right-2 top-1/2 transform -translate-y-1/2" 
            : "right-0 top-1/2 transform -translate-y-1/2 translate-x-16"
        )}
      >
        <Image
          src="/icons/donate.png"
          alt="donate"
          width={isMobile ? 32 : 40}
          height={isMobile ? 32 : 40}
          className="transition-opacity hover:opacity-80"
        />
      </Link>
    </>
  );
}