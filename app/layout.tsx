import type { Metadata } from "next";
import Script from "next/script";
import { GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";
import { googleAdsenseId, googleTagManagerId } from "../utils/const";
import Header from "../components/Header";
import Aside from "../components/Aside";
import Footer from "../components/Footer";
import { getAllPosts } from "../utils/readPosts";

export const metadata: Metadata = {
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
  verification: {
    other: {
      "google-adsense-account": googleAdsenseId,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const posts = getAllPosts();

  return (
    <html lang="ja">
      <body className="bg-neutral-200 dark:bg-neutral-900">
        <div className="duration-400 min-h-screen text-neutral-900 dark:text-neutral-50 transition-all">
          <div className="grid grid-cols-10 justify-center max-w-7xl mx-auto">
            <Header className="col-span-10" />
            <main className="col-span-10 md:col-span-7">{children}</main>
            <Aside
              className="col-span-10 md:col-span-3"
              posts={posts ? posts : []}
            />
            <Footer className="col-span-10" />
          </div>
        </div>
      </body>
      <GoogleTagManager gtmId={googleTagManagerId} />
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${googleAdsenseId}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </html>
  );
}
