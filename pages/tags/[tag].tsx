import { orderBy, range, union } from "lodash";
import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import Pagination from "../../components/Pagination";
import PostCard from "../../components/PostCard";
import type { SerializablePostData } from "../../types/post";
import { postsPerPage, siteDescription, siteTitle } from "../../utils/const";
import { convertSerializablePostDataToPostData } from "../../utils/posts";
import { listPosts } from "../../utils/readPosts"

type PageProps = {
  posts: SerializablePostData[];
  slicedPosts: SerializablePostData[];
  pages: number[];
  tag: string;
};

export const getStaticProps: GetStaticProps<PageProps> = ({ params }) => {
  if (typeof params?.tag !== "string") throw new Error("`tag` parameter is not a string");
  const tag = params.tag;
  const posts = orderBy(listPosts(), o => new Date(o.date), "desc");
  const filteredPosts = posts.filter(post => {
    if (post.tags.map(tag => tag.name.toLowerCase()).includes(tag)) return post;
  });
  const slicedPosts = filteredPosts.slice(0, postsPerPage);
  const pages = range(1, Math.ceil(filteredPosts.length / postsPerPage) + 1);
  return {
    props: {
      posts,
      slicedPosts,
      pages,
      tag,
    },
  };
};

export const getStaticPaths = () => {
  const posts = listPosts();
  const posts_ = posts.map(serializedPost => convertSerializablePostDataToPostData(serializedPost));
  const tagNames = union(posts_.map(post => post.tags.map(tag => tag.name)).flat());
  const paths = tagNames.map(tagName => ({
    params: {
      tag: tagName.toLowerCase(),
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
  const capitalizedTag = tag[0].toUpperCase() + tag.slice(1);
  return (
    <div>
      <Head>
        <title>{`${capitalizedTag} - ${siteTitle}`}</title>
        <meta name="description" content={siteDescription + `${capitalizedTag}についての記事を表示しています。`} />
      </Head>

      {postCards}
      <Pagination
        pages={pages}
        currentPage={1}
        parentPath={`/tags/${tag}/page`}
        topPath={`/tags/${tag}`}
      />
    </div>
  );
};

export default Tag;
