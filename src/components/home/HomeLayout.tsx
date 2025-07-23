// src/components/home/HomeLayout.tsx
'use client';

import React, { useEffect } from 'react';
import Head from 'next/head';

interface HomeLayoutProps {
  children: React.ReactNode;
}

export default function HomeLayout({ children }: HomeLayoutProps) {
  useEffect(() => {
    // Dynamically add 98.css to the head for home page only
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/98.css';
    link.id = '98css-home';
    document.head.appendChild(link);

    // Cleanup function to remove the CSS when component unmounts
    return () => {
      const existingLink = document.getElementById('98css-home');
      if (existingLink) {
        document.head.removeChild(existingLink);
      }
    };
  }, []);

  return (
    <>
      <Head>
        <link rel="stylesheet" href="https://unpkg.com/98.css" />
      </Head>
      {children}
    </>
  );
}