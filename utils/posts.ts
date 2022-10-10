import type { PostData, SerializablePostData } from "../types/post";

export const convertSerializablePostDataToPostData = (post: SerializablePostData): PostData => {
  return Object.assign(post, {date: new Date(post.date)});
};
