'use client';

import { useEffect } from 'react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cursorScript = document.createElement("script");
    cursorScript.src = "/animatedcursor.js";
    cursorScript.async = false;
    document.body.appendChild(cursorScript);

    const onekoScript = document.createElement("script");
    onekoScript.src = "/oneko.js";
    onekoScript.async = true;
    document.body.appendChild(onekoScript);

    return () => {
      document.body.removeChild(cursorScript);
      document.body.removeChild(onekoScript);
    };
  }, []);

  return <>{children}</>;
}
