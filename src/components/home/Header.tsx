// src/components/home/Header.tsx
import React from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import AuthButtons from '@/components/AuthButtons';

interface HeaderProps {
  version: string;
  isMobile: boolean;
  onOpenProfileCustomizer: () => void;
}

export default function Header({ version, isMobile, onOpenProfileCustomizer }: HeaderProps) {
  return (
    <div className={cn(
      "absolute top-3 right-3 flex items-center space-x-2 z-20",
      isMobile && "top-2 right-2 space-x-1"
    )}>
      <p className={cn(
        "text-gray-500",
        isMobile ? "text-xs" : "text-xs"
      )}>
        v{version}
      </p>
      
      {/* Auth Buttons - now includes Profile Customizer button when authenticated */}
      <div className={cn(isMobile && "scale-90")}>
        <AuthButtons 
          onOpenProfileCustomizer={onOpenProfileCustomizer}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}