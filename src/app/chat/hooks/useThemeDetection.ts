// src/app/chat/hooks/useThemeDetection.ts - FIXED VERSION
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/components/theme-provider';

export const useThemeDetection = (isMounted: boolean) => {
  const { currentTheme } = useTheme();
  const [pinkThemeActive, setPinkThemeActive] = useState(false);

  // ✅ CRITICAL FIX: Stabilized theme detection to prevent infinite re-renders
  const checkPinkTheme = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const themeLink = document.getElementById('dynamic-win98-theme-style') as HTMLLinkElement;
    const isActive = themeLink && themeLink.href.includes('pink-theme.css');
    return isActive;
  }, []);

  // ✅ FIXED: Pink theme detection effect with proper debouncing
  useEffect(() => {
    if (!isMounted) return;

    // Initial check
    const initialState = checkPinkTheme();
    setPinkThemeActive(initialState);

    // Debounced theme checker to prevent rapid state updates
    let debounceTimeout: NodeJS.Timeout | null = null;
    
    const debouncedCheck = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      debounceTimeout = setTimeout(() => {
        const currentState = checkPinkTheme();
        setPinkThemeActive(prev => {
          // Only update if the value actually changed
          if (prev !== currentState) {
            console.log('[ThemeDetection] Pink theme state changed:', prev, '→', currentState);
            return currentState;
          }
          return prev;
        });
      }, 100); // 100ms debounce
    };

    // Create observer with more specific targeting
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      for (const mutation of mutations) {
        // Only check if link elements were added/removed or href attributes changed
        if (mutation.type === 'childList') {
          const hasLinkChanges = Array.from(mutation.addedNodes).some(node => 
            node.nodeName === 'LINK' || (node as Element)?.id === 'dynamic-win98-theme-style'
          ) || Array.from(mutation.removedNodes).some(node => 
            node.nodeName === 'LINK' || (node as Element)?.id === 'dynamic-win98-theme-style'
          );
          
          if (hasLinkChanges) {
            shouldCheck = true;
            break;
          }
        } else if (mutation.type === 'attributes' && 
                   mutation.attributeName === 'href' && 
                   (mutation.target as Element)?.id === 'dynamic-win98-theme-style') {
          shouldCheck = true;
          break;
        }
      }
      
      if (shouldCheck) {
        debouncedCheck();
      }
    });

    // Observe only the head element with specific filters
    if (document.head) {
      observer.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href'], // Only watch href changes
        attributeOldValue: false    // Don't need old values
      });
    }

    // Cleanup function
    return () => {
      observer.disconnect();
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [isMounted, checkPinkTheme]); // Stable dependencies

  const effectivePageTheme = isMounted ? currentTheme : 'theme-98';

  return {
    pinkThemeActive,
    effectivePageTheme
  };
};