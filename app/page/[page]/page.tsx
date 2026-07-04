import { range } from "lodash";
import Pagination from "../../../components/Pagination";
import PostList from "../../../components/PostList";
import {
  baseUrl,
  postsPerPage,
  siteDescription,
  siteTitle,
} from "../../../utils/const";
import { getAllPosts } from "../../../utils/readPosts";
import { Metadata } from "next";

export async function generateStaticParams() {
  const posts = getAllPosts();
  const count = posts.length;

  return range(1, Math.ceil(count / postsPerPage) + 1).map((i) => ({
    page: i.toString(),
  }));
}

type Props = {
  params: Promise<{ page: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const currentPage = Number((await params).page);

  return {
    title: siteTitle,
    description: siteDescription,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      url: `/page/${currentPage}`,
      siteName: siteTitle,
      images: "/images/ogp-image.jpg",
      locale: "ja_JP",
      type: "website",
    },
    twitter: {
      card: "summary",
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const currentPage = Number((await params).page);

  const posts = getAllPosts();

  const slicedPosts = posts.slice(
    postsPerPage * (currentPage - 1),
    postsPerPage * currentPage,
  );
  const pages = range(1, Math.ceil(posts.length / postsPerPage) + 1);

  return (
    <div>
      <PostList posts={slicedPosts} />
      <Pagination
        pages={pages}
        currentPage={currentPage}
        parentPath="/page"
        topPath="/"
      />
    </div>
  );
}
