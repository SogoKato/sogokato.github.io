import { orderBy, range } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Pagination from "../../components/Pagination";
import PostCard from "../../components/PostCard";
import Seo from "../../components/Seo";
import type { SerializablePostSummary } from "../../types/post";
import {
  basePostDir,
  postsPerPage,
  siteDescription,
  siteTitle,
} from "../../utils/const";
import { convertSerializablePostSummaryToPostSummary } from "../../utils/posts";
import { getPostsRecursively, listPostSummaries } from "../../utils/readPosts";

type PageProps = {
  posts: SerializablePostSummary[];
  slicedPosts: SerializablePostSummary[];
  pages: number[];
  currentPage: number;
};

export const getStaticProps: GetStaticProps<PageProps> = ({ params }) => {
  if (typeof params?.page !== "string")
    throw new Error("`page` parameter is not a string");
  const currentPage = Number(params.page);
  const posts = orderBy(listPostSummaries(), (o) => new Date(o.date), "desc");
  const slicedPosts = posts.slice(
    postsPerPage * (currentPage - 1),
    postsPerPage * currentPage
  );
  const pages = range(1, Math.ceil(posts.length / postsPerPage) + 1);
  return {
    props: {
      posts,
      slicedPosts,
      pages,
      currentPage,
    },
  };
};

export const getStaticPaths = () => {
  const posts: string[][] = [];
  getPostsRecursively(basePostDir, posts);
  const count = posts.length;
  const paths = range(1, Math.ceil(count / postsPerPage) + 1).map((i) => ({
    params: {
      page: i.toString(),
    },
  }));
  return {
    paths,
    fallback: false,
  };
};

const Page: NextPage<PageProps> = ({ slicedPosts, pages, currentPage }) => {
  const postCards = slicedPosts.map((serializedPost, index) => {
    const post = convertSerializablePostSummaryToPostSummary(serializedPost);
    return <PostCard key={index} post={post} />;
  });
  return (
    <div>
      <Seo
        title={siteTitle}
        description={siteDescription}
        path={`/page/${currentPage}`}
        type="website"
      />
      {postCards}
      <Pagination
        pages={pages}
        currentPage={currentPage}
        parentPath="/page"
        topPath="/"
      />
    </div>
  );
};

export default Page;
