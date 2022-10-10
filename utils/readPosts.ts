import fs from "fs";
import matter from "gray-matter";
import { basePostDir } from "./const";
import type { SerializablePostData } from "../types/post";

export const listPosts = (): SerializablePostData[] => {
  const posts: string[][] = [];
  getPostsRecursively(basePostDir, posts);
  return posts.map(post => {
    const ref = "/" + post.join("/");
    post.splice(post.length - 1, 1, post[post.length - 1] + ".md")
    const fileContent = fs.readFileSync(post.join("/"), "utf-8");
    const { data, content } = matter(fileContent);
    return {
      title: data.title,
      date: data.date,
      ref: ref,
      desc: data.description ? data.description : content.slice(0, 300).replace(/\[(.+)\]\(.+\)/g, "$1"),
      content: content,
      tags: (data.tags as string[]).map(tag => ({
        name: tag,
        ref: `/tags/${tag.toLowerCase()}`,
      })),
    };
  });
};

export const getPostsRecursively = (parentPath: string, posts: string[][]) => {
  const filesOrDirs = fs.readdirSync(parentPath);
  filesOrDirs.forEach(fileOrDir => {
    if (fs.statSync(`${parentPath}/${fileOrDir}`).isDirectory()) {
      getPostsRecursively(`${parentPath}/${fileOrDir}`, posts);
    } else {
      posts.push(parentPath.split("/").concat([fileOrDir.replace(/\.md$/, "")]));
    }
  });
};
