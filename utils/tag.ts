import { orderBy, union } from "lodash";
import { PostData, PostSummary } from "../types/post";

import { TagData } from "../types/tag";

export const getTagRef = (tagName: string): string => {
  return `/tags/${tagName.toLowerCase().replace("/", "-").replace(" ", "-")}`
};

export const aggregateTags = (posts: PostSummary[] | PostData[]): TagData[] => {
  const tagNames = union(posts.map(post => post.tags.map(tag => tag.name)).flat());
  type Count = {
    tagName: string;
    count: number;
  }
  const countsByTagName: Count[] = tagNames.map(tagName => {
    let count = 0;
    posts.forEach(post => post.tags.forEach(tag => {
      if (tag.name === tagName) count++;
    }));
    return {
      tagName: tagName,
      count: count,
    };
  });
  const tagNamesByDescOrder = orderBy(countsByTagName, "count", "desc").map(count => count.tagName);
  const tags = tagNamesByDescOrder.map(tagName => ({
    name: tagName,
    ref: getTagRef(tagName),
  }));
  const refs: string[] = [];
  tags.forEach(tag => {
    if (refs.includes(tag.ref)) throw new Error(`Duplicate tag ref found: ${tag.ref}`);
    refs.push(tag.ref);
  });
  return tags;
};
