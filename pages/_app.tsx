import Head from "next/head";
import type { AppProps } from "next/app";
import { GoogleTagManager } from '@next/third-parties/google'
import Layout from "../components/Layout";
import "../styles/globals.css";
import { googleTagManagerId } from "../utils/const";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Layout {...pageProps}>
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
      <GoogleTagManager gtmId={googleTagManagerId} />
    </Layout>
  );
}

export default MyApp;
