'use client';

import { usePathname } from 'next/navigation';
import { TopBar } from '@/components/top-bar';

export function ConditionalTopBar() {
  const pathname = usePathname();

  if (pathname === '/') {
    // Render hidden TopBar for cleanup effects, but don't display it
    return (
      <div style={{ display: 'none' }}>
        <TopBar />
      </div>
    );
  }

  return <TopBar />;
}