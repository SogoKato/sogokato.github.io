"use client";

import dynamic from "next/dynamic";

type AdType = "display" | "multiplex";
type AdProps = {
  type: AdType;
  format?: string;
  fullWidthResponsive?: boolean;
  className?: string;
};

export default function Ad({
  type,
  format,
  fullWidthResponsive,
  className,
}: AdProps) {
  const AdSense = dynamic(() => import("./AdSense"), { ssr: false });
  return (
    <AdSense
      type={type}
      format={format}
      fullWidthResponsive={fullWidthResponsive}
      className={className}
    />
  );
}
