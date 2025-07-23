'use client';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export default function HomeButton() {
  return (
    <Link 
      href="/" 
      className="fixed top-4 left-4 z-50 hover:opacity-80 transition-opacity cursor-pointer"
      title="Go to Home Page"
    >
      <Image
        src="/favicon.ico"
        alt="Home"
        width={24}
        height={24}
        className="cursor-pointer"
        priority
      />
    </Link>
  );
}