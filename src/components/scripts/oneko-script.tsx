'use client';

import { useEffect } from "react";

export default function OnekoScript() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/oneko.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}
