import { orderBy, range } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Pagination from "../../../../components/Pagination";
import PostListItem from "../../../../components/PostListItem";
import Seo from "../../../../components/Seo";
import type { SerializablePostMeta } from "../../../../types/post";
import { TagData } from "../../../../types/tag";
import {
  postsPerPage,
  siteDescription,
  siteTitle,
} from "../../../../utils/const";
import { aggregateTags, getTagRef } from "../../../../utils/tag";
import { getRawPosts } from "../../../../utils/readPosts";
import {
  convertRawPostToSerializablePostMeta,
  convertSerializablePostMetaToPostMeta,
} from "../../../../utils/posts";

type PageProps = {
  posts: SerializablePostMeta[];
  slicedPosts: SerializablePostMeta[];
  pages: number[];
  currentPage: number;
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
  const currentPage = Number(params?.page);
  const filteredPosts = posts.filter((post) => {
    if (post.tags.map((tag) => getTagRef(tag.name)).includes(matchedTag.ref))
      return post;
  });
  const slicedPosts = filteredPosts.slice(
    postsPerPage * (currentPage - 1),
    postsPerPage * currentPage
  );
  const pages = range(1, Math.ceil(filteredPosts.length / postsPerPage) + 1);
  return {
    props: {
      posts,
      slicedPosts,
      pages,
      currentPage,
      tag: matchedTag,
    },
  };
};

export const getStaticPaths = () => {
  const rawPosts = getRawPosts();
  const posts = rawPosts.map((p) => convertRawPostToSerializablePostMeta(p));
  const tags = aggregateTags(posts);
  const paths = tags
    .map((tag) => {
      const count = posts.length;
      return range(1, Math.ceil(count / postsPerPage) + 1).map((i) => ({
        params: {
          tag: tag.ref.replace("/tags/", ""),
          page: i.toString(),
        },
      }));
    })
    .flat();
  return {
    paths,
    fallback: false,
  };
};

const TagPage: NextPage<PageProps> = ({
  slicedPosts,
  pages,
  currentPage,
  tag,
}) => {
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
        path={`${tag.ref}/page/${currentPage}`}
        type="website"
      />

      {postCards}
      <Pagination
        pages={pages}
        currentPage={currentPage}
        parentPath={`${tag.ref}/page`}
        topPath={tag.ref}
      />
    </div>
  );
};

export default TagPage;
