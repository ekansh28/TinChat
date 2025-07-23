// components/GoogleAd.tsx
"use client";

import { useEffect } from "react";

interface GoogleAdProps {
  adClient: string;
  adSlot: string;
  adFormat?: string;
  layoutKey?: string;
  style?: React.CSSProperties;
  className?: string;
}

const GoogleAd: React.FC<GoogleAdProps> = ({
  adClient,
  adSlot,
  adFormat = "auto",
  layoutKey,
  style = { display: "block" },
  className = "",
}) => {
  useEffect(() => {
    try {
      // Push the ad when the component mounts
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("Adsense push error:", err);
    }
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={style}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
    />
  );
};

export default GoogleAd;
