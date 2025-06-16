// hooks/useWebamp.ts
import { useEffect, useRef } from 'react';

export const useWebamp = (containerRef: React.RefObject<HTMLElement>, tracks: any[]) => {
  const webampRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const initWebamp = async () => {
      if (!containerRef.current || webampRef.current) return;

      try {
        const { default: Webamp } = await import('webamp');
        if (!mounted) return;

        const webamp = new Webamp({ initialTracks: tracks });
        await webamp.renderWhenReady(containerRef.current);
        
        if (mounted) {
          webampRef.current = webamp;
        } else {
          webamp.dispose();
        }
      } catch (error) {
        console.error('Webamp init error:', error);
      }
    };

    initWebamp();

    return () => {
      mounted = false;
      // Don't dispose here - let the page unload handle it
    };
  }, []);

  return webampRef.current;
};