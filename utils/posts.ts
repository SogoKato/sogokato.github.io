import type { Post, RawPost, RecommendedPost } from "../types/post";
import { TagData } from "../types/tag";
import { recommendPostsFromPost } from "./recommend";
import { getTagRef } from "./tag";

export const convertRawPostToPost = (post: RawPost, posts: RawPost[]): Post => {
  const recommendation = recommendPostsFromPost(posts, post);
  const metadata = Object.assign({}, post.metadata, {
    date: new Date(post.metadata.date),
  });

  return {
    ...metadata,
    content: post.content,
    recommendation,
  };
};

export const convertPostToRecommendedPost = (
  post: Post,
  reason: string | undefined = undefined
): RecommendedPost => {
  return {
    ...post,
    reason,
  };
};

export const convertRawPostToRecommendedPost = (
  post: RawPost,
  reason: string | undefined = undefined
): RecommendedPost => {
  return {
    ...post.metadata,
    date: new Date(post.metadata.date),
    reason,
  };
};

export const filterPostsByTag = (posts: Post[], tag: TagData) => {
  return posts.filter((post) => {
    if (post.tags.map((t) => getTagRef(t.name)).includes(tag.ref)) return post;
  });
};
