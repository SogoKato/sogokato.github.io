"use client";

import dynamic from "next/dynamic";

type AdType = "display" | "multiplex";
type AdProps = {
  type: AdType;
  className?: string;
};

export default function Ad({ type, className }: AdProps) {
  const AdSense = dynamic(() => import("./AdSense"), { ssr: false });
  return <AdSense type={type} className={className} />;
}
