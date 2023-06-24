import { orderBy, range } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Pagination from "../components/Pagination";
import PostCard from "../components/PostCard";
import Seo from "../components/Seo";
import type { SerializablePostSummary } from "../types/post";
import { postsPerPage, siteDescription, siteTitle } from "../utils/const";
import { convertSerializablePostSummaryToPostSummary } from "../utils/posts";
import { listPostSummaries } from "../utils/readPosts";

type HomeProps = {
  posts: SerializablePostSummary[];
  slicedPosts: SerializablePostSummary[];
  pages: number[];
};

export const getStaticProps: GetStaticProps<HomeProps> = () => {
  const posts = orderBy(listPostSummaries(), (o) => new Date(o.date), "desc");
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
    const post = convertSerializablePostSummaryToPostSummary(serializedPost);
    return <PostCard key={index} post={post} />;
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
