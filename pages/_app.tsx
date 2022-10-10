import Head from "next/head";
import type { AppProps } from "next/app";
import Layout from "../components/Layout";
import "../styles/globals.css";
import usePageView from "../hooks/usePageView";

function MyApp({ Component, pageProps }: AppProps) {
  usePageView();
  return (
    <Layout {...pageProps}>
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </Layout>
  );
}

export default MyApp;
