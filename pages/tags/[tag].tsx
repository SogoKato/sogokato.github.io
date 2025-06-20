import { orderBy, range } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Pagination from "../../components/Pagination";
import PostListItem from "../../components/PostListItem";
import Seo from "../../components/Seo";
import { TagData } from "../../types/tag";
import { postsPerPage, siteDescription, siteTitle } from "../../utils/const";
import { aggregateTags, getTagRef } from "../../utils/tag";
import { SerializablePostMeta } from "../../types/post";
import { getRawPosts } from "../../utils/readPosts";
import {
  convertRawPostToSerializablePostMeta,
  convertSerializablePostMetaToPostMeta,
} from "../../utils/posts";

type PageProps = {
  posts: SerializablePostMeta[];
  slicedPosts: SerializablePostMeta[];
  pages: number[];
  tag: TagData;
};

export const getStaticProps: GetStaticProps<PageProps> = ({ params }) => {
  if (typeof params?.tag !== "string")
    throw new Error("`tag` parameter is not a string");
  const tagRef = params.tag;

  const rawPosts = orderBy(
    getRawPosts(),
    (o) => new Date(o.metadata.date),
    "desc"
  );
  const posts = rawPosts.map((p) => convertRawPostToSerializablePostMeta(p));
  const tags = aggregateTags(posts);

  const matchedTags = tags.filter(
    (tag) => tag.ref.replace("/tags/", "") === tagRef
  );
  if (matchedTags.length !== 1)
    throw new Error("Multiple tags or nothing found but 1 is expected.");

  const matchedTag = matchedTags[0];
  const filteredPosts = posts.filter((post) => {
    if (post.tags.map((tag) => getTagRef(tag.name)).includes(matchedTag.ref))
      return post;
  });
  const slicedPosts = filteredPosts.slice(0, postsPerPage);

  const pages = range(1, Math.ceil(filteredPosts.length / postsPerPage) + 1);

  return {
    props: {
      posts,
      slicedPosts,
      pages,
      tag: matchedTag,
    },
  };
};

export const getStaticPaths = () => {
  const rawPosts = getRawPosts();
  const posts = rawPosts.map((p) => convertRawPostToSerializablePostMeta(p));
  const tags = aggregateTags(posts);
  const paths = tags.map((tag) => ({
    params: {
      tag: tag.ref.replace("/tags/", ""),
    },
  }));
  return {
    paths,
    fallback: false,
  };
};

const Tag: NextPage<PageProps> = ({ slicedPosts, pages, tag }) => {
  const postCards = slicedPosts.map((p, index) => {
    const post = convertSerializablePostMetaToPostMeta(p);
    return <PostListItem key={index} post={post} />;
  });
  return (
    <div>
      <Seo
        title={`${tag.name} - ${siteTitle}`}
        description={
          siteDescription + `${tag.name}についての記事を表示しています。`
        }
        path={tag.ref}
        type="website"
      />

      {postCards}
      <Pagination
        pages={pages}
        currentPage={1}
        parentPath={`${tag.ref}/page`}
        topPath={tag.ref}
      />
    </div>
  );
};

export default Tag;
