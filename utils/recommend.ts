import { RawPost, SerializableRecommendedPost } from "../types/post";
import { TagData } from "../types/tag";
import { convertRawPostToSerializablePostMeta } from "./posts";
import { cosineSimilarity } from "./vector";

export const recommendPostsGlobal = (
  posts: RawPost[]
): SerializableRecommendedPost[] => {
  return posts
    .filter((_, i) => i < 5)
    .map((p) => convertRawPostToSerializablePostMeta(p));
};

export const recommendPostsFromPost = (
  posts: RawPost[],
  post: RawPost
): SerializableRecommendedPost[] => {
  const otherPosts = posts.filter(
    (otherPost) => otherPost.metadata.ref !== post.metadata.ref
  );

  const ret: SerializableRecommendedPost[] = [];

  // Recommend related posts using embeddings.
  if (post.embedding !== null) {
    ret.splice(0, 0, ...recommendPostsByEmbedding(otherPosts, post.embedding));
  }
  if (ret.length >= 5) {
    ret.splice(5, Infinity);
    return posts.map((p) => convertRawPostToSerializablePostMeta(p));
  }

  // Recommend the posts which have the same tag.
  ret.splice(
    ret.length,
    0,
    ...recommendPostsByTags(otherPosts, post.metadata.tags)
  );
  if (ret.length >= 5) {
    ret.splice(5, Infinity);
    return ret;
  }

  // Recommend the latest posts which have not been seen.
  const seenPostRefs = ret.map((post) => post.ref);
  const notSeenPosts = otherPosts
    .filter((post) => !seenPostRefs.includes(post.metadata.ref))
    .map((p) => convertRawPostToSerializablePostMeta(p));
  ret.splice(ret.length, 0, ...notSeenPosts);

  if (ret.length >= 5) {
    ret.splice(5, Infinity);
  }

  return ret;
};

export const recommendPostsByEmbedding = (
  otherPosts: RawPost[],
  embedding: number[]
): SerializableRecommendedPost[] => {
  return otherPosts.reduce(
    (accumulator: SerializableRecommendedPost[], otherPost) => {
      if (!Array.isArray(otherPost.embedding)) return accumulator;

      const score = cosineSimilarity(embedding, otherPost.embedding);
      if (score < 0.88) return accumulator;

      const p = convertRawPostToSerializablePostMeta(otherPost);
      accumulator.push({
        ...p,
        reason: `類似度 ${(score * 100).toFixed(1)}%`,
      });
      return accumulator;
    },
    []
  );
};

export const recommendPostsByTags = (
  otherPosts: RawPost[],
  tags: TagData[]
): SerializableRecommendedPost[] => {
  const tagNames = tags.map((tag) => tag.name);
  return otherPosts.reduce(
    (accumulator: SerializableRecommendedPost[], otherPost) => {
      const sameTags: string[] = [];
      for (const tag of otherPost.metadata.tags) {
        if (tagNames.includes(tag.name)) {
          sameTags.push(tag.name);
        }
      }

      if (sameTags.length > 0) {
        const p = convertRawPostToSerializablePostMeta(otherPost);
        accumulator.push({ ...p, reason: `🏷️ ${sameTags.join(", ")}` });
      }

      return accumulator;
    },
    []
  );
};
