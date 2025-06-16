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
      setPinkThemeActive(isActive);
      return isActive;
    };

    checkPinkTheme();

    const observer = new MutationObserver(() => {
      checkPinkTheme();
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
  }, []);

  const effectivePageTheme = isMounted ? currentTheme : 'theme-98';

  return {
    pinkThemeActive,
    effectivePageTheme
  };
};