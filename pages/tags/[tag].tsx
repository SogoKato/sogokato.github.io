import { orderBy, range, union } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Pagination from "../../components/Pagination";
import PostCard from "../../components/PostCard";
import Seo from "../../components/Seo";
import type { SerializablePostData } from "../../types/post";
import { TagData } from "../../types/tag";
import { postsPerPage, siteDescription, siteTitle } from "../../utils/const";
import { convertSerializablePostDataToPostData } from "../../utils/posts";
import { listPosts } from "../../utils/readPosts"
import { aggregateTags, getTagRef } from "../../utils/tag";

type PageProps = {
  posts: SerializablePostData[];
  slicedPosts: SerializablePostData[];
  pages: number[];
  tag: TagData;
};

export const getStaticProps: GetStaticProps<PageProps> = ({ params }) => {
  if (typeof params?.tag !== "string") throw new Error("`tag` parameter is not a string");
  const tagRef = params.tag;
  const posts_ = listPosts().map(serializedPost => convertSerializablePostDataToPostData(serializedPost));
  const tags = aggregateTags(posts_);
  const matchedTags = tags.filter(tag => tag.ref.replace("/tags/", "") === tagRef);
  if (matchedTags.length !== 1) throw new Error("Multiple tags or nothing found but 1 is expected.");
  const matchedTag = matchedTags[0];
  const posts = orderBy(listPosts(), o => new Date(o.date), "desc");
  const filteredPosts = posts.filter(post => {
    if (post.tags.map(tag => getTagRef(tag.name)).includes(matchedTag.ref)) return post;
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
  const posts = listPosts();
  const posts_ = posts.map(serializedPost => convertSerializablePostDataToPostData(serializedPost));
  const tags = aggregateTags(posts_);
  const paths = tags.map(tag => ({
    params: {
      tag: tag.ref.replace("/tags/", ""),
    }
  }));
  return {
    paths,
    fallback: false,
  };
};

const Tag: NextPage<PageProps> = ({ slicedPosts, pages, tag }) => {
  const postCards = slicedPosts.map((serializedPost, index) => {
    const post = convertSerializablePostDataToPostData(serializedPost);
    return (
      <PostCard key={index} post={post} isPostPage={false} />
    );
  });
  return (
    <div>
      <Seo
        title={`${tag.name} - ${siteTitle}`}
        description={siteDescription + `${tag.name}についての記事を表示しています。`}
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
