import Head from "next/head";
import { baseUrl , siteTitle} from "../utils/const";

type SeoProps = {
  title: string;
  description: string;
  path: string;
  type: "website" | "article" | "profile";
};

const Seo: React.FC<SeoProps> = ({ title, description, path, type }) => {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta httpEquiv="content-language" content="ja" />
      <meta property="og:url" content={baseUrl + path} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={siteTitle} />
      <meta property="og:image" content={baseUrl + "/images/ogp-image.jpg"} />
      <meta name="twitter:card" content="summary"/>
    </Head>
  )
};

export default Seo;
