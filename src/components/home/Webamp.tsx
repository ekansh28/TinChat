// components/home/Webamp.tsx
'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import type { default as WebampType } from 'webamp';

// Define the props interface for Webamp component
interface WebampProps {
  className?: string;
  style?: React.CSSProperties;
  initialTracks?: Array<{
    metaData: {
      artist: string;
      title: string;
    };
    url: string;
    duration: number;
  }>;
}

const WebampPlayer: React.FC<WebampProps> = ({ 
  className, 
  style,
  initialTracks = [
    {
      metaData: {
        artist: "Yume 2kki",
        title: "Lotus Waters",
      },
      url: "/songs/lotus.mp3",
      duration: 240,
    },
  ]
}) => {
  const webampInstanceRef = useRef<WebampType | null>(null);
  const webampContainerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef<boolean>(true);

  const calculateLayout = useCallback(() => {
    const headerHeight = 40;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Milkdrop dimensions (size multiplier * 25 + base width)
    const milkdropSize = [12, 2]; 
    const milkdropWidth = (milkdropSize[0] - 1) * 25 + 275; // Base width is 275
    const milkdropHeight = (milkdropSize[1] - 1) * 29 + 116; // Base height is 116
    
    // Main window dimensions
    const mainWidth = 275;
    const mainHeight = 116;
    
    // Equalizer dimensions
    const equalizerWidth = 275;
    const equalizerHeight = 116;
    
    // Playlist dimensions 
    const playlistWidth = 275;
    const playlistHeight = 116 + (4 * 29); // 4 rows * 29px per row
    
    // Calculate positions
    const milkdropX = (windowWidth ) + 70;
    const milkdropY = headerHeight + 40;
    
    // Main, Equalizer, Playlist: Top right corner
    const rightMargin = 20;
    const topMargin = headerHeight + 20;
    
    const mainX = windowWidth - mainWidth - rightMargin;
    const mainY = topMargin;
    
    const equalizerX = windowWidth - equalizerWidth - rightMargin;
    const equalizerY = topMargin + mainHeight + 10;
    
    const playlistX = windowWidth - playlistWidth - rightMargin;
    const playlistY = topMargin + mainHeight + equalizerHeight + 20;
    
    return {
      main: { position: { x: mainX, y: mainY + 20} },
      equalizer: { position: { x: equalizerX, y: equalizerY + 10} },
      playlist: { position: { x: playlistX, y: playlistY + 5}, size: [0, 4] },
      milkdrop: { position: { x: milkdropX + 300, y: milkdropY }, size: milkdropSize },
    };
  }, []);

  const initializeWebamp = useCallback(async () => {
    if (!mountedRef.current || 
        !webampContainerRef.current || 
        webampInstanceRef.current ||
        typeof window === 'undefined') {
      return;
    }

    try {
      // Dynamic import to avoid SSR issues
      const { default: Webamp } = await import('webamp');

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!mountedRef.current || !webampContainerRef.current) {
        return;
      }

      const layout = calculateLayout();
      
      const webamp = new Webamp({
        initialTracks,
        __butterchurnOptions: {
          importButterchurn: () => {
            return import("butterchurn");
          },
          getPresets: (async () => {
            const resp = await fetch(
              "https://unpkg.com/butterchurn-presets-weekly@0.0.2/weeks/week1/presets.json"
            );
            const namesToPresetUrls = await resp.json();
            const presetEntries = Object.entries(namesToPresetUrls);
            const presets = await Promise.all(
              presetEntries.map(async ([name, url]) => {
                const presetResp = await fetch(url as string);
                const butterchurnPresetObject = await presetResp.json();
                return { name, butterchurnPresetObject };
              })
            );
            return presets;
          }) as any,
          butterchurnOpen: true,
        },
        __initialWindowLayout: layout,
      } as any);

      if (!mountedRef.current) {
        try {
          webamp.dispose();
        } catch (e) {
          // Ignore disposal errors if component unmounted
        }
        return;
      }

      webampInstanceRef.current = webamp;
      await webamp.renderWhenReady(webampContainerRef.current);

    } catch (error) {
      console.error('Failed to initialize Webamp:', error);
    }
  }, [initialTracks, calculateLayout]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (webampInstanceRef.current) {
        // You might want to implement a debounced resize handler here
        // For now, we'll just log that a resize occurred
        console.log('Window resized - layout may need adjustment');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    initializeWebamp();

    return () => {
      mountedRef.current = false;
      if (webampInstanceRef.current) {
        try {
          webampInstanceRef.current.dispose();
          webampInstanceRef.current = null;
        } catch (error) {
          console.warn('Webamp disposal error:', error);
        }
      }
    };
  }, [initializeWebamp]);

  return (
    <div 
      ref={webampContainerRef}
      className={className}
      style={{
        position: 'fixed',
        top: '-13vh',
        left: '-41vw',
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Allow clicks to pass through empty areas
        zIndex: 1000, // Adjust as needed for your layout
        ...style
      }}
    />
  );
};

export default WebampPlayer;