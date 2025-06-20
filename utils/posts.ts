import type {
  RecommendedPost,
  Post,
  PostMeta,
  RawPost,
  SerializablePost,
  SerializablePostMeta,
  SerializableRecommendedPost,
} from "../types/post";
import { recommendPostsFromPost, recommendPostsGlobal } from "./recommend";

export const convertSerializablePostMetaToPostMeta = (
  post: SerializablePostMeta
): PostMeta => {
  return Object.assign(post, { date: new Date(post.date) });
};

export const convertSerializableRecommendedPostToRecommendedPost = (
  post: SerializableRecommendedPost
): RecommendedPost => {
  return convertSerializablePostMetaToPostMeta(post);
};

export const convertSerializablePostToPost = (post: SerializablePost): Post => {
  return Object.assign(post, {
    date: new Date(post.date),
    recommendation: post.recommendation.map((p) =>
      convertSerializablePostMetaToPostMeta(p)
    ),
  });
};

export const convertRawPostToSerializablePostMeta = (
  post: RawPost
): SerializablePostMeta => {
  return post.metadata;
};

export const convertRawPostToSerializablePost = (
  post: RawPost,
  posts: RawPost[],
  recommendationStrategy: "byPost" | "global" = "byPost"
): SerializablePost => {
  const recommendation =
    recommendationStrategy === "byPost"
      ? recommendPostsFromPost(posts, post)
      : recommendPostsGlobal(posts);
  return {
    ...post.metadata,
    content: post.content,
    recommendation,
  };
};
