import { orderBy } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import PostCard from "../../components/PostCard";
import PostPagination from "../../components/PostPagination";
import Seo from "../../components/Seo";
import type { SerializablePostData } from "../../types/post";
import { basePostDir, siteTitle } from "../../utils/const";
import { convertSerializablePostDataToPostData } from "../../utils/posts";
import { getPostsRecursively, listPosts } from "../../utils/readPosts";

type PostProps = {
  posts: SerializablePostData[];
  post: SerializablePostData;
};

export const getStaticProps: GetStaticProps<PostProps> = ({ params }) => {
  const posts = orderBy(listPosts(), o => new Date(o.date), "desc");
  if (!Array.isArray(params?.slug)) throw new Error("`slug` parameter is not an array.");
  if (!params?.slug) throw new Error("`slug` parameter is null or undefined.");
  const slug = params.slug;
  const post = posts.filter(post => {
    if (post.ref === `/posts/${slug.join("/")}`) {
      return post;
    }
  })[0];
  return {
    props: {
      posts,
      post,
    },
  };
};

export const getStaticPaths = () => {
  const posts = listPosts();
  const paths = posts.map(post => {
    const split = post.ref.split("/");
    return {
      params: {
        slug: split.slice(2, split.length),
      }
    };
  });
  return {
    paths,
    fallback: false,
  }
};

const Post: NextPage<PostProps> = ({ posts, post }) => {
  const post_ = convertSerializablePostDataToPostData(post);
  const currentPostIndex = posts.map(post => post.ref).indexOf(post.ref);
  if (currentPostIndex === -1) throw new Error("Could not find current post.");
  const nextPost = currentPostIndex > 0 ? convertSerializablePostDataToPostData(posts[currentPostIndex - 1]) : null;
  const prevPost = currentPostIndex < posts.length - 1 ? convertSerializablePostDataToPostData(posts[currentPostIndex + 1]) : null;
  return (
    <article>
      <Seo
        title={`${post.title} - ${siteTitle}`}
        description={post.desc}
        path={post.ref}
        type="article"
      />

      <PostCard
        className="prose dark:prose-invert prose-neutral"
        post={post_}
        isPostPage={true}
      />
      <div className="flex flex-col sm:flex-row justify-between mx-auto w-11/12">
        {nextPost ? <PostPagination className="w-full sm:w-1/2" post={nextPost} isNext={true} /> : <div></div>}
        {prevPost ? <PostPagination className="w-full sm:w-1/2" post={prevPost} isNext={false} /> : <div></div>}
      </div>
    </article>
  );
};

export default Post;
