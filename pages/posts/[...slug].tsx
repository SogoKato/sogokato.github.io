import { orderBy } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import PostCard from "../../components/PostCard";
import PostPagination from "../../components/PostPagination";
import Seo from "../../components/Seo";
import type {
  SerializablePostData,
  SerializablePostSummary,
} from "../../types/post";
import { siteTitle } from "../../utils/const";
import { convertSerializablePostSummaryToPostSummary } from "../../utils/posts";
import { getPostData, listPostSummaries } from "../../utils/readPosts";

type PostProps = {
  posts: SerializablePostSummary[];
  post: SerializablePostData;
};

export const getStaticProps: GetStaticProps<PostProps> = ({ params }) => {
  const posts = orderBy(listPostSummaries(), (o) => new Date(o.date), "desc");
  if (!Array.isArray(params?.slug))
    throw new Error("`slug` parameter is not an array.");
  if (!params?.slug) throw new Error("`slug` parameter is null or undefined.");
  const slug = params.slug;
  const post = getPostData(`/posts/${slug.join("/")}`);
  return {
    props: {
      posts,
      post,
    },
  };
};

export const getStaticPaths = () => {
  const posts = listPostSummaries();
  const paths = posts.map((post) => {
    const split = post.ref.split("/");
    return {
      params: {
        slug: split.slice(2, split.length),
      },
    };
  });
  return {
    paths,
    fallback: false,
  };
};

const Post: NextPage<PostProps> = ({ posts, post }) => {
  const post_ = convertSerializablePostSummaryToPostSummary(post);
  const currentPostIndex = posts.map((post) => post.ref).indexOf(post.ref);
  if (currentPostIndex === -1) throw new Error("Could not find current post.");
  const nextPost =
    currentPostIndex > 0
      ? convertSerializablePostSummaryToPostSummary(posts[currentPostIndex - 1])
      : null;
  const prevPost =
    currentPostIndex < posts.length - 1
      ? convertSerializablePostSummaryToPostSummary(posts[currentPostIndex + 1])
      : null;
  return (
    <article>
      <Seo
        title={`${post.title} - ${siteTitle}`}
        description={post.desc}
        path={post.ref}
        type="article"
      />
      <PostCard
        className="max-w-none prose dark:prose-invert prose-pre:m-0 prose-neutral prose-pre:px-2 prose-pre:py-1"
        post={post_}
      />
      <div className="flex flex-col sm:flex-row justify-between mx-auto w-11/12">
        {nextPost ? (
          <PostPagination
            className="mb-4 sm:mb-0 w-full sm:w-1/2"
            post={nextPost}
            isNext={true}
          />
        ) : (
          <div></div>
        )}
        {prevPost ? (
          <PostPagination
            className="w-full sm:w-1/2"
            post={prevPost}
            isNext={false}
          />
        ) : (
          <div></div>
        )}
      </div>
    </article>
  );
};

export default Post;
