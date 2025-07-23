// src/app/chat/hooks/useViewport.ts
import { useState, useEffect, useMemo } from 'react';

export const useViewport = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (mobile) {
        const height = window.visualViewport?.height || window.innerHeight;
        setViewportHeight(height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    const handleResize = () => checkMobile();
    const handleVisualViewportChange = () => {
      if (isMobile && window.visualViewport) {
        const height = window.visualViewport.height;
        setViewportHeight(height);
      }
    };

    checkMobile();
    
    window.addEventListener('resize', handleResize);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportChange);
      }
    };
  }, [isMobile]);

  const chatWindowStyle = useMemo(() => {
    if (isMobile) {
      return { 
        width: '100vw', 
        height: viewportHeight > 0 ? `${viewportHeight}px` : '100vh',
        maxWidth: '100vw',
        maxHeight: viewportHeight > 0 ? `${viewportHeight}px` : '100vh',
        minHeight: viewportHeight > 0 ? `${viewportHeight}px` : '100vh'
      };
    }
    return { 
      width: '600px', 
      height: '600px',
      minHeight: '600px',
      maxHeight: '600px'
    };
  }, [isMobile, viewportHeight]);

  return {
    isMobile,
    viewportHeight,
    chatWindowStyle
  };
};