import { range } from "lodash";
import Pagination from "../components/Pagination";
import {
  baseUrl,
  postsPerPage,
  siteDescription,
  siteTitle,
} from "../utils/const";
import PostListItem from "../components/PostListItem";
import { getAllPosts } from "../utils/readPosts";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  metadataBase: new URL(baseUrl),
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: siteTitle,
    images: "/images/ogp-image.jpg",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
  },
};

export default async function Home() {
  const posts = getAllPosts();
  const slicedPosts = posts.slice(0, postsPerPage);

  const pages = range(1, Math.ceil(posts.length / postsPerPage) + 1);

  const postListItems = slicedPosts.map((p, index) => {
    return <PostListItem key={index} post={p} />;
  });

  return (
    <div>
      {postListItems}
      <Pagination
        pages={pages}
        currentPage={1}
        parentPath="/page"
        topPath="/"
      />
    </div>
  );
}
