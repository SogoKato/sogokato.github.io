import { useRouter } from "next/router";
import { googleAdsenseId } from "../utils/const";
import { useEffect } from "react";

declare global {
  var adsbygoogle: unknown[];
}

type AdType = "display" | "multiplex";
type AdSenseProps = {
  type: AdType;
  className?: string;
};

export default function AdSense({ type, className }: AdSenseProps) {
  const router = useRouter();
  useEffect(() => {
    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error(error);
    }
  }, [router.asPath]);
  if (window.adsbygoogle === undefined) return null;
  const { adSlot, adFormat, fullWidthResponsive } = getSlotValue(type);
  const baseClassName = "overflow-hidden rounded-md ";
  const placeholder =
    process.env.NODE_ENV === "development" ? (
      <div className="bg-white h-80 text-black text-center w-full">広告</div>
    ) : null;
  return (
    <div className={baseClassName + className} key={router.asPath}>
      {placeholder}
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={googleAdsenseId}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
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
