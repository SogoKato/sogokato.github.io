import fs from "fs";
import matter from "gray-matter";
import { basePostDir } from "./const";
import type {
  SerializablePostData,
  SerializablePostSummary,
} from "../types/post";
import { getTagRef } from "./tag";
import { loadSummaryIndex } from "./vectorIndex";

export const listPostSummaries = (): SerializablePostSummary[] => {
  const posts = listPostsRaw();
  return posts.map((post) => post.summary);
};

export const getPostData = (ref: string): SerializablePostData => {
  const posts = listPostsRaw();
  const post = posts.filter((post) => post.summary.ref === ref)[0];

  return {
    ...post.summary,
    content: post.content,
  };
};

interface PostRaw {
  summary: SerializablePostSummary;
  content: string;
}

const listPostsRaw = (): PostRaw[] => {
  const posts: string[][] = [];
  getPostsRecursively(basePostDir, posts);

  const vecIndex = loadSummaryIndex();

  const allPosts = posts.map((post) => {
    const ref = "/" + post.join("/");
    post.splice(post.length - 1, 1, post[post.length - 1] + ".md");
    const filepath = post.join("/");
    const fileContent = fs.readFileSync(filepath, "utf-8");
    const { data, content } = matter(fileContent);

    const embedding = vecIndex[ref]?.embedding ? vecIndex[ref].embedding : null;

    return {
      summary: {
        title: data.title,
        date: data.date,
        ref: ref,
        filepath,
        desc: data.description
          ? data.description
          : content
              .slice(0, 1000)
              .replace("\n", " ")
              .replace(/\[(.+?)\]\(.+?\)/g, "$1")
              .slice(0, 256),
        embedding,
        draft: data.draft ? data.draft : false,
        tags: (data.tags as string[]).map((tag) => ({
          name: tag,
          ref: getTagRef(tag),
        })),
        showTerminalAside: data.showTerminalAside
          ? data.showTerminalAside
          : false,
      },
      content,
    };
  });
  return allPosts.filter(
    (post) =>
      !post.summary.draft ||
      (process.env.NODE_ENV === "development" && post.summary.draft)
  );
};

export const getPostsRecursively = (parentPath: string, posts: string[][]) => {
  const filesOrDirs = fs.readdirSync(parentPath);
  filesOrDirs.forEach((fileOrDir) => {
    if (fs.statSync(`${parentPath}/${fileOrDir}`).isDirectory()) {
      getPostsRecursively(`${parentPath}/${fileOrDir}`, posts);
    } else {
      posts.push(
        parentPath.split("/").concat([fileOrDir.replace(/\.md$/, "")])
      );
    }
  });
};
