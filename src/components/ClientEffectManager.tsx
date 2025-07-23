
'use client';

import React, { useEffect } from 'react';

// Ensure the Window interface is augmented for your custom cursor functions
// If not already globally declared, you might need this here or in a global .d.ts file
declare global {
  interface Window {
    startOriginalOneko?: () => void;
    stopOriginalOneko?: () => void;
    hideOriginalOneko?: () => void;
    showOriginalOneko?: () => void;    startAnimatedGifCursor?: (gifUrl: string) => boolean;
    stopAnimatedGifCursor?: () => boolean;
    hideAnimatedGifCursor?: () => boolean;
    showAnimatedGifCursor?: () => boolean;
  }
}

export function ClientEffectManager() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Stop all cursors initially to prevent multiple active if preferences change
    window.stopOriginalOneko?.();
    window.stopAnimatedGifCursor?.();
    document.body.style.cursor = 'auto'; // Good default

    const savedNekoActive = localStorage.getItem('nekoActive');
    const savedAnimatedCursorUrl = localStorage.getItem('animatedCursorUrl');
    const savedStaticCursorUrl = localStorage.getItem('selectedCursorUrl');

    if (savedNekoActive === 'true') {
      window.startOriginalOneko?.();
      document.body.style.cursor = 'auto'; // Neko is an overlay, system cursor should be auto
    } else if (savedAnimatedCursorUrl) {
      window.startAnimatedGifCursor?.(savedAnimatedCursorUrl);
      document.body.style.cursor = 'none'; // Hide system cursor for JS animated GIF
    } else if (savedStaticCursorUrl) {
      document.body.style.cursor = `url(${savedStaticCursorUrl}), auto`;
    } else {
      // This is the case for "Default Cursor" - ensure it's auto
      document.body.style.cursor = 'auto'; // Explicitly set for default
    }

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isInteractive = target.closest('button, a, select, input, textarea, [role="button"], [role="tab"]');

      if (isInteractive) {
        const isAnimatedGifActive = !!localStorage.getItem('animatedCursorUrl');
        // const isNekoActive = localStorage.getItem('nekoActive') === 'true'; // Neko should not hide

        if (isAnimatedGifActive) { 
          window.hideAnimatedGifCursor?.();
        }
        // Neko (OriginalOneko) is no longer hidden on hover
        // CSS :hover rules in globals.css will take care of showing system pointer/text cursor
      }
    };

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      let isStillOverInteractive = false;
      if (event.relatedTarget) {
        isStillOverInteractive = !!(event.relatedTarget as HTMLElement).closest?.('button, a, select, input, textarea, [role="button"], [role="tab"]');
      }

      if (!isStillOverInteractive && target.closest('button, a, select, input, textarea, [role="button"], [role="tab"]')) {
        const isAnimatedGifActive = !!localStorage.getItem('animatedCursorUrl');
        // const isNekoActive = localStorage.getItem('nekoActive') === 'true'; // Neko should not be shown based on hover out

        if (isAnimatedGifActive) {
          window.showAnimatedGifCursor?.();
        }
        // Neko (OriginalOneko) is no longer shown based on hover out
      }
    };

    document.body.addEventListener('mouseover', handleMouseOver);
    document.body.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.body.removeEventListener('mouseover', handleMouseOver);
      document.body.removeEventListener('mouseout', handleMouseOut);
      // Optionally, stop cursors when the component unmounts (e.g., on full page navigation if this manager was per-page)
      // For a root layout, this cleanup might only run on app close, which is fine.
      // window.stopOriginalOneko?.();
      // window.stopAnimatedGifCursor?.();
    };
  }, []);

  return null; // This component doesn't render any UI itself, it's for side effects
}
