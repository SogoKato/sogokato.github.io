import { orderBy, range } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import Pagination from "../components/Pagination";
import PostCard from "../components/PostCard";
import type { SerializablePostData } from "../types/post";
import { postsPerPage, siteDescription, siteTitle } from "../utils/const";
import { convertSerializablePostDataToPostData } from "../utils/posts";
import { listPosts } from "../utils/readPosts";

type HomeProps = {
  posts: SerializablePostData[];
  slicedPosts: SerializablePostData[];
  pages: number[];
};

export const getStaticProps: GetStaticProps<HomeProps> = () => {
  const posts = orderBy(listPosts(), o => new Date(o.date), "desc");
  const slicedPosts = posts.slice(0, postsPerPage);
  const pages = range(1, Math.ceil(posts.length / postsPerPage) + 1);
  return {
    props: {
      posts,
      slicedPosts,
      pages,
    },
  }
};

const Home: NextPage<HomeProps> = ({ slicedPosts, pages }) => {
  const postCards = slicedPosts.map((serializedPost, index) => {
    const post = convertSerializablePostDataToPostData(serializedPost);
    return (
      <PostCard key={index} post={post} isPostPage={false} />
    );
  });
  return (
    <div>
      <Head>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDescription} />
      </Head>

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
