import fs from "fs";
import matter from "gray-matter";
import { orderBy } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import PostCard from "../components/PostCard";
import Seo from "../components/Seo";
import type { SerializablePost, SerializablePostMeta } from "../types/post";
import { siteDescription, siteTitle } from "../utils/const";
import {
  convertRawPostToSerializablePostMeta,
  convertSerializablePostToPost,
} from "../utils/posts";
import { getRawPosts } from "../utils/readPosts";
import { recommendPostsGlobal } from "../utils/recommend";

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
  const fileContent = fs.readFileSync("privacy.md", "utf-8");
  const { data, content } = matter(fileContent);
  const posts = rawPosts.map((p) => convertRawPostToSerializablePostMeta(p));
  const post = {
    title: data.title,
    date: "",
    ref: "",
    filepath: "",
    desc: "",
    embedding: null,
    draft: false,
    content: content,
    tags: [],
    showTerminalAside: false,
    recommendation: recommendPostsGlobal(rawPosts),
  };
  return {
    props: {
      posts,
      post,
    },
  };
};

const Post: NextPage<PostProps> = ({ post: JSONPost }) => {
  const post = convertSerializablePostToPost(JSONPost);
  return (
    <article>
      <Seo
        title={`${post.title} - ${siteTitle}`}
        description={siteDescription}
        path="/privacy"
        type="article"
      />
      <PostCard
        className="max-w-none prose dark:prose-invert prose-pre:m-0 prose-neutral prose-pre:px-2 prose-pre:py-1"
        post={post}
        isStaticPostPage={true}
      />
    </article>
  );
};

export default Post;
