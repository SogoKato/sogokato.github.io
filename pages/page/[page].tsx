import { orderBy, range } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Pagination from "../../components/Pagination";
import PostListItem from "../../components/PostListItem";
import Seo from "../../components/Seo";
import type { SerializablePostMeta } from "../../types/post";
import { postsPerPage, siteDescription, siteTitle } from "../../utils/const";
import {
  convertRawPostToSerializablePostMeta,
  convertSerializablePostMetaToPostMeta,
} from "../../utils/posts";
import { getRawPosts } from "../../utils/readPosts";

type PageProps = {
  posts: SerializablePostMeta[];
  slicedPosts: SerializablePostMeta[];
  pages: number[];
  currentPage: number;
};

export const getStaticProps: GetStaticProps<PageProps> = ({ params }) => {
  if (typeof params?.page !== "string")
    throw new Error("`page` parameter is not a string");
  const currentPage = Number(params.page);
  const rawPosts = orderBy(
    getRawPosts(),
    (o) => new Date(o.metadata.date),
    "desc"
  );
  const posts = rawPosts.map((p) => convertRawPostToSerializablePostMeta(p));
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
  const posts = getRawPosts();
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
    const post = convertSerializablePostMetaToPostMeta(serializedPost);
    return <PostListItem key={index} post={post} />;
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
