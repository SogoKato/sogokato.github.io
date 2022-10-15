import fs from "fs";
import matter from "gray-matter";
import { orderBy } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import PostCard from "../components/PostCard";
import Seo from "../components/Seo";
import type { SerializablePostData } from "../types/post";
import { siteDescription, siteTitle } from "../utils/const";
import { convertSerializablePostDataToPostData } from "../utils/posts";
import { listPosts } from "../utils/readPosts";

type PostProps = {
  posts: SerializablePostData[];
  post: SerializablePostData;
};

export const getStaticProps: GetStaticProps<PostProps> = ({ params }) => {
  const posts = orderBy(listPosts(), o => new Date(o.date), "desc");
  const fileContent = fs.readFileSync("privacy.md", "utf-8");
  const { data, content } = matter(fileContent);
  return {
    props: {
      posts,
      post: {
        title: data.title,
        date: "",
        ref: "",
        desc: "",
        content: content,
        tags: [],
      },
    },
  };
};

const Post: NextPage<PostProps> = ({ post }) => {
  const post_ = convertSerializablePostDataToPostData(post);
  return (
    <article>
      <Seo
        title={`${post.title} - ${siteTitle}`}
        description={siteDescription}
        path="/privacy"
        type="article"
      />

      <PostCard
        className="prose dark:prose-invert prose-neutral"
        post={post_}
        isPostPage={true}
        isStaticPostPage={true}
      />
    </article>
  );
};

export default Post;
