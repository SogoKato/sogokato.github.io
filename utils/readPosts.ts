import fs from "fs";
import matter from "gray-matter";
import { basePostDir } from "./const";
import type { SerializablePostData } from "../types/post";
import { getTagRef } from "./tag";

export const listPosts = (): SerializablePostData[] => {
  const posts: string[][] = [];
  getPostsRecursively(basePostDir, posts);
  const allPosts = posts.map(post => {
    const ref = "/" + post.join("/");
    post.splice(post.length - 1, 1, post[post.length - 1] + ".md")
    const fileContent = fs.readFileSync(post.join("/"), "utf-8");
    const { data, content } = matter(fileContent);
    return {
      title: data.title,
      date: data.date,
      ref: ref,
      desc: data.description ? data.description : content.slice(0, 300).replace(/\[(.+?)\]\(.+?\)/g, "$1"),
      draft: data.draft ? data.draft : false,
      content: content,
      tags: (data.tags as string[]).map(tag => ({
        name: tag,
        ref: getTagRef(tag),
      })),
    };
  });
  return allPosts.filter(post => !post.draft || (process.env.NODE_ENV === "development" && post.draft));
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
