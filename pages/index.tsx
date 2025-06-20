import { orderBy, range } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Pagination from "../components/Pagination";
import PostCard from "../components/PostCard";
import Seo from "../components/Seo";
import type { SerializablePostMeta } from "../types/post";
import { postsPerPage, siteDescription, siteTitle } from "../utils/const";
import {
  convertRawPostToSerializablePostMeta,
  convertSerializablePostMetaToPostMeta,
} from "../utils/posts";
import PostListItem from "../components/PostListItem";
import { getRawPosts } from "../utils/readPosts";

type HomeProps = {
  posts: SerializablePostMeta[];
  slicedPosts: SerializablePostMeta[];
  pages: number[];
};

export const getStaticProps: GetStaticProps<HomeProps> = () => {
  const rawPosts = orderBy(
    getRawPosts(),
    (o) => new Date(o.metadata.date),
    "desc"
  );
  const posts = rawPosts.map((p) => convertRawPostToSerializablePostMeta(p));
  const slicedPosts = posts.slice(0, postsPerPage);
  const pages = range(1, Math.ceil(posts.length / postsPerPage) + 1);
  return {
    props: {
      posts,
      slicedPosts,
      pages,
    },
  };
};

const Home: NextPage<HomeProps> = ({ slicedPosts, pages }) => {
  const postCards = slicedPosts.map((serializedPost, index) => {
    const post = convertSerializablePostMetaToPostMeta(serializedPost);
    return <PostListItem key={index} post={post} />;
  });

  return (
    <div>
      <Seo
        title={siteTitle}
        description={siteDescription}
        path="/"
        type="website"
      />
      {postCards}
      <Pagination
        pages={pages}
        currentPage={1}
        parentPath="/page"
        topPath="/"
      />
    </div>
  );
};

export default Home;
