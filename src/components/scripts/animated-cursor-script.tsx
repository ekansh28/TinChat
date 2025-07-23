'use client';

import { useEffect } from "react";

export default function AnimatedCursorScript() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/animatedcursor.js";
    script.async = false;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}
