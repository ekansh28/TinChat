// components/home/Webamp.tsx
'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import type { default as WebampType } from 'webamp';

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
  const initializedRef = useRef(false);

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
    const milkdropX = (windowWidth) + 70;
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
      milkdrop: { position: { x: milkdropX + 300, y: milkdropY - 200 }, size: milkdropSize },
    };
  }, []);

  const initializeWebamp = useCallback(async () => {
    if (initializedRef.current || !webampContainerRef.current) return;

    try {
      const { default: Webamp } = await import('webamp');
      
      if (initializedRef.current || !webampContainerRef.current) return;

      const webamp = new Webamp({
        initialTracks,
        __butterchurnOptions: {
          importButterchurn: () => import("butterchurn"),
          getPresets: async () => {
            const resp = await fetch(
              "https://unpkg.com/butterchurn-presets-weekly@0.0.2/weeks/week1/presets.json"
            );
            const presets = await resp.json();
            return Promise.all(
              Object.entries(presets).map(async ([name, url]) => {
                const presetResp = await fetch(url as string);
                return {
                  name,
                  butterchurnPresetObject: await presetResp.json()
                };
              })
            );
          },
          butterchurnOpen: true,
        },
        __initialWindowLayout: calculateLayout(),
      } as any);

      webampInstanceRef.current = webamp;
      initializedRef.current = true;
      
      await webamp.renderWhenReady(webampContainerRef.current);
    } catch (error) {
    }
  }, [initialTracks, calculateLayout]);

  useEffect(() => {
    const timer = setTimeout(() => {
      initializeWebamp();
    }, 500); // Small delay to ensure DOM stability

    return () => {
      clearTimeout(timer);
      if (webampInstanceRef.current) {
        try {
          webampInstanceRef.current.dispose();
        } catch (error) {
        }
        webampInstanceRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [initializeWebamp]);

  return (
    <div 
      ref={webampContainerRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        right: 340,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        ...style
      }}
    />
  );
};

export default React.memo(WebampPlayer);