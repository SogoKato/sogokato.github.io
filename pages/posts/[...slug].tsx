import { orderBy } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import dynamic from "next/dynamic";
import PostCard from "../../components/PostCard";
import PostPagination from "../../components/PostPagination";
import Seo from "../../components/Seo";
import type { SerializablePost, SerializablePostMeta } from "../../types/post";
import { siteTitle } from "../../utils/const";
import {
  convertRawPostToSerializablePost,
  convertRawPostToSerializablePostMeta,
  convertSerializablePostMetaToPostMeta,
  convertSerializablePostToPost,
} from "../../utils/posts";
import { getRawPosts } from "../../utils/readPosts";

type PostProps = {
  posts: SerializablePostMeta[];
  post: SerializablePost;
};

export const getStaticProps: GetStaticProps<PostProps> = ({ params }) => {
  const rawPosts = orderBy(
    getRawPosts(),
    (o) => new Date(o.metadata.date),
    "desc"
  );
  if (!Array.isArray(params?.slug))
    throw new Error("`slug` parameter is not an array.");
  if (!params?.slug) throw new Error("`slug` parameter is null or undefined.");
  const slug = params.slug;
  const rawPost = rawPosts.filter(
    (p) => p.metadata.ref === `/posts/${slug.join("/")}`
  )[0];
  const posts = rawPosts.map((p) => convertRawPostToSerializablePostMeta(p));
  const post = convertRawPostToSerializablePost(rawPost, rawPosts);
  return {
    props: {
      posts,
      post,
    },
  };
};

export const getStaticPaths = () => {
  const posts = getRawPosts();
  const paths = posts.map((post) => {
    const split = post.metadata.ref.split("/");
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

const Post: NextPage<PostProps> = ({ posts: JSONPosts, post: JSONPost }) => {
  const post = convertSerializablePostToPost(JSONPost);
  const currentPostIndex = JSONPosts.map((p) => p.ref).indexOf(post.ref);
  if (currentPostIndex === -1)
    throw new Error("Could not find the current post.");
  const nextPost =
    currentPostIndex > 0
      ? convertSerializablePostMetaToPostMeta(JSONPosts[currentPostIndex - 1])
      : null;
  const prevPost =
    currentPostIndex < JSONPosts.length - 1
      ? convertSerializablePostMetaToPostMeta(JSONPosts[currentPostIndex + 1])
      : null;
  const AdSense = dynamic(() => import("../../components/AdSense"), {
    ssr: false,
  });
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
        post={post}
      />
      <div className="flex flex-col sm:flex-row justify-between mb-4 mx-auto w-11/12">
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
      <AdSense type="multiplex" className="mb-4 mx-auto w-11/12" />
    </article>
  );
};

export default Post;
