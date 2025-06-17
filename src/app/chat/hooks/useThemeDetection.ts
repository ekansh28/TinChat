// src/app/chat/hooks/useThemeDetection.ts
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme-provider';

export const useThemeDetection = (isMounted: boolean) => {
  const { currentTheme } = useTheme();
  const [pinkThemeActive, setPinkThemeActive] = useState(false);

  // Pink theme detection effect
useEffect(() => {
  const checkPinkTheme = () => {
    if (typeof window === 'undefined') return false;
    const themeLink = document.getElementById('dynamic-win98-theme-style') as HTMLLinkElement;
    const isActive = themeLink && themeLink.href.includes('pink-theme.css');
    
    // Only update if value actually changed
    setPinkThemeActive(prev => prev !== isActive ? isActive : prev);
    return isActive;
  };

  checkPinkTheme();

  const observer = new MutationObserver(() => {
    // Debounce to prevent rapid calls
    setTimeout(checkPinkTheme, 100);
  });

  if (document.head) {
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href']
    });
  }

  return () => observer.disconnect();
}, []); // Keep empty - no changing dependencies

  const effectivePageTheme = isMounted ? currentTheme : 'theme-98';

  return {
    pinkThemeActive,
    effectivePageTheme
  };
};