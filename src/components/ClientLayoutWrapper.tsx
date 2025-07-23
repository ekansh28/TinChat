// src/components/ClientLayoutWrapper.tsx
'use client';

import { usePathname } from 'next/navigation';

interface ClientLayoutWrapperProps {
  children: React.ReactNode;
}

export function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const pathname = usePathname();
  
  return (
    <main key={pathname} className="flex-1 flex flex-col relative">
      {children}
    </main>
  );
}