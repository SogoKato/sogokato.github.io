"use client";

import { usePathname } from "next/navigation";
import { googleAdsenseId } from "../utils/const";
import { useEffect, useRef } from "react";

declare global {
  var adsbygoogle: unknown[];
}

type AdType = "display" | "multiplex";
type AdSenseProps = {
  type: AdType;
  format?: string;
  fullWidthResponsive?: boolean;
  className?: string;
};

export default function AdSense({
  type,
  format,
  fullWidthResponsive: fullWidthResponsiveProp,
  className,
}: AdSenseProps) {
  const pathname = usePathname();
  const {
    adSlot,
    adFormat,
    fullWidthResponsive: defaultFullWidthResponsive,
  } = getSlotValue(type);
  const insRef = useRef<HTMLModElement>(null);
  const fullWidthResponsive =
    fullWidthResponsiveProp !== undefined
      ? String(fullWidthResponsiveProp)
      : defaultFullWidthResponsive;

  useEffect(() => {
    if (insRef.current?.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error(e);
    }
  }, [pathname]);

  const baseClassName = "overflow-hidden ";
  return (
    <div className={baseClassName + className} key={pathname}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={googleAdsenseId}
        data-ad-slot={adSlot}
        data-ad-format={format ?? adFormat}
        data-full-width-responsive={fullWidthResponsive}
      />
    </div>
  );
}

function getSlotValue(type: AdType) {
  switch (type) {
    case "display":
      return {
        adSlot: "5354666743",
        adFormat: "auto",
        fullWidthResponsive: "true",
      };
    case "multiplex":
      return {
        adSlot: "3295463705",
        adFormat: "autorelaxed",
        fullWidthResponsive: undefined,
      };
  }
}
