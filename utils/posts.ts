import type { PostSummary, SerializablePostSummary } from "../types/post";

export const convertSerializablePostSummaryToPostSummary = (
  post: SerializablePostSummary
): PostSummary => {
  return Object.assign(post, { date: new Date(post.date) });
};
