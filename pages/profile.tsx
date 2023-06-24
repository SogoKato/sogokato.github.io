import fs from "fs";
import matter from "gray-matter";
import { orderBy } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import PostCard from "../components/PostCard";
import Seo from "../components/Seo";
import type { SerializablePostData, SerializablePostSummary } from "../types/post";
import { siteDescription, siteTitle } from "../utils/const";
import { convertSerializablePostSummaryToPostSummary } from "../utils/posts";
import { listPostSummaries } from "../utils/readPosts";

type PostProps = {
  posts: SerializablePostSummary[];
  post: SerializablePostData;
};

export const getStaticProps: GetStaticProps<PostProps> = ({ params }) => {
  const posts = orderBy(listPostSummaries(), (o) => new Date(o.date), "desc");
  const fileContent = fs.readFileSync("README.md", "utf-8");
  const { data, content } = matter(fileContent);
  return {
    props: {
      posts,
      post: {
        title: data.title,
        date: "",
        ref: "",
        desc: "",
        draft: false,
        content: content,
        tags: [],
        showTerminalAside: false,
      },
    },
  };
};

const Post: NextPage<PostProps> = ({ post }) => {
  const post_ = convertSerializablePostSummaryToPostSummary(post);
  return (
    <article>
      <Seo
        title={`${post.title} - ${siteTitle}`}
        description={siteDescription}
        path="/profile"
        type="profile"
      />

      <PostCard
        className="max-w-none prose dark:prose-invert prose-neutral"
        post={post_}
        isStaticPostPage={true}
      />
    </article>
  );
};

export default Post;
