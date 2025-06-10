// ===== src/components/ConditionalGoldfishImage.tsx =====
import React from 'react';
import Image from 'next/image';

export const ConditionalGoldfishImage: React.FC = () => {
  return (
    <div className="absolute bottom-2 right-2 opacity-50 pointer-events-none">
      <Image
        src="/images/goldfish.png"
        alt="Goldfish decoration"
        width={48}
        height={48}
        className="animate-pulse"
        onError={() => {
          // Hide image if it fails to load
          const img = document.querySelector('[alt="Goldfish decoration"]') as HTMLElement;
          if (img) img.style.display = 'none';
        }}
      />
    </div>
  );
};
