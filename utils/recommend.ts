import { RawPost, Post, RecommendedPost } from "../types/post";
import { TagData } from "../types/tag";
import {
  convertPostToRecommendedPost,
  convertRawPostToRecommendedPost,
} from "./posts";
import { cosineSimilarity } from "./vector";

export const recommendPostsGlobal = (posts: Post[]): RecommendedPost[] => {
  return posts
    .filter((_, i) => i < 5)
    .map((p) => convertPostToRecommendedPost(p));
};

export const recommendPostsFromPost = (
  posts: RawPost[],
  post: RawPost
): RecommendedPost[] => {
  const otherPosts = posts.filter(
    (otherPost) => otherPost.metadata.ref !== post.metadata.ref
  );

  let ret: RecommendedPost[] = [];

  // Recommend related posts using embeddings.
  if (post.embedding !== null) {
    ret.splice(0, 0, ...recommendPostsByEmbedding(otherPosts, post.embedding));
  }
  if (ret.length >= 5) {
    ret.splice(5, Infinity);
    return posts.map((p) => convertRawPostToRecommendedPost(p));
  }

  // Recommend the posts which have the same tag.
  ret = mergeRecommendation(
    ret,
    recommendPostsByTags(otherPosts, post.metadata.tags)
  );
  if (ret.length >= 5) {
    ret.splice(5, Infinity);
    return ret;
  }

  // Recommend the latest posts which have not been seen.
  const seenPostRefs = ret.map((post) => post.ref);
  const notSeenPosts = otherPosts
    .filter((p) => !seenPostRefs.includes(p.metadata.ref))
    .map((p) => convertRawPostToRecommendedPost(p));
  ret = mergeRecommendation(ret, notSeenPosts);

  if (ret.length >= 5) {
    ret.splice(5, Infinity);
  }

  return ret;
};

const mergeRecommendation = (
  a: RecommendedPost[],
  b: RecommendedPost[]
): RecommendedPost[] => {
  const ret = [...a.map((ap) => ({ ...ap }))];

  const aRefs = a.map((ap) => ap.ref);
  const bUnique = b.filter((bp) => {
    if (!aRefs.includes(bp.ref)) return true;

    ret.forEach((ap) => {
      if (ap.ref !== bp.ref) return;
      if (!bp.reason) return;

      if (!ap.reason) {
        ap.reason = bp.reason;
        return;
      }
      ap.reason += ` | ${bp.reason}`;
    });
    return false;
  });

  ret.splice(ret.length, 0, ...bUnique);

  return ret;
};

export const recommendPostsByEmbedding = (
  otherPosts: RawPost[],
  embedding: number[]
): RecommendedPost[] => {
  return otherPosts.reduce((accumulator: RecommendedPost[], otherPost) => {
    if (!Array.isArray(otherPost.embedding)) return accumulator;

    const score = cosineSimilarity(embedding, otherPost.embedding);
    if (score < 0.88) return accumulator;

    const p = convertRawPostToRecommendedPost(
      otherPost,
      `類似度 ${(score * 100).toFixed(1)}%`
    );
    accumulator.push(p);
    return accumulator;
  }, []);
};

export const recommendPostsByTags = (
  otherPosts: RawPost[],
  tags: TagData[]
): RecommendedPost[] => {
  const tagNames = tags.map((tag) => tag.name);
  return otherPosts.reduce((accumulator: RecommendedPost[], otherPost) => {
    const sameTags: string[] = [];
    for (const tag of otherPost.metadata.tags) {
      if (tagNames.includes(tag.name)) {
        sameTags.push(tag.name);
      }
    }

    if (sameTags.length > 0) {
      const p = convertRawPostToRecommendedPost(
        otherPost,
        `🏷️ ${sameTags.join(", ")}`
      );
      accumulator.push(p);
    }

    return accumulator;
  }, []);
};
