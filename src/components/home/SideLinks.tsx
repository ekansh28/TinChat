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
    <div className={cn(
      "flex justify-center items-center gap-8",
      isMobile ? "gap-6" : "gap-8"
    )}>
      {/* Discord Link */}
      <Link 
        href="https://discord.gg/gayporn" 
        target="_blank" 
        rel="noopener noreferrer"
        className="transition-transform hover:scale-110"
      >
        <Image
          src="/icons/discord.gif"
          alt="discord"
          width={isMobile ? 32 : 88}
          height={isMobile ? 32 : 31}
          className="transition-opacity hover:opacity-80"
        />
      </Link>

      {/* Donate Link */}
      <Link 
        href="https://paypal.me/ekansh32" 
        target="_blank" 
        rel="noopener noreferrer"
        className="transition-transform hover:scale-110"
      >
        <Image
          src="/icons/donate.png"
          alt="donate"
          width={isMobile ? 32 : 80}
          height={isMobile ? 32 : 15}
          className="transition-opacity hover:opacity-80"
        />
      </Link>
    </div>
  );
}