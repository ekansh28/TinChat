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
      
      {/* Profile Customizer Button - Only show on desktop or as icon on mobile */}
      <Button
        onClick={onOpenProfileCustomizer}
        variant="outline"
        size={isMobile ? "sm" : "default"}
        className={cn(
          "flex items-center gap-1",
          isMobile && "px-2 py-1 text-xs scale-90"
        )}
      >
        <span className="text-sm">🎨</span>
        {!isMobile && <span>Profile</span>}
      </Button>
      
      {/* Auth Buttons */}
      <div className={cn(isMobile && "scale-90")}>
        <AuthButtons />
      </div>
    </div>
  );
}