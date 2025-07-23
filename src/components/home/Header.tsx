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
  <div className="w-full z-0 relative">
    <div className="title-bar">
      <div className="title-bar-text">
        <div className={cn(
          "flex items-center justify-between w-full",
          isMobile && "space-x-1"
        )}>
         <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>TinChat v{version}</span>
                         
          <div className="flex items-center space-x-2">
            <p className={cn(
              "text-gray-500",
              isMobile ? "text-xs" : "text-xs"
            )}>

            </p>
            
            {/* Auth Buttons - now includes Profile Customizer button when authenticated */}
            <div className={cn(isMobile && "scale-90")}>
              <AuthButtons 
                onOpenProfileCustomizer={onOpenProfileCustomizer}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
);
}