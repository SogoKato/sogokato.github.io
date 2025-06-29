import { range } from "lodash";
import Pagination from "../../../components/Pagination";
import PostListItem from "../../../components/PostListItem";
import {
  baseUrl,
  postsPerPage,
  siteDescription,
  siteTitle,
} from "../../../utils/const";
import { aggregateTags } from "../../../utils/tag";
import { getAllPosts } from "../../../utils/readPosts";
import { filterPostsByTag } from "../../../utils/posts";
import { Metadata } from "next";

export async function generateStaticParams() {
  const posts = getAllPosts();
  const tags = aggregateTags(posts);

  return tags.map((t) => ({
    tag: t.ref.replace("/tags/", ""),
  }));
}

type Props = {
  params: Promise<{ tag: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tagSlug = decodeURIComponent((await params).tag);

  const posts = getAllPosts();
  const tags = aggregateTags(posts);

  const matchedTags = tags.filter(
    (tag) => tag.ref.replace("/tags/", "") === tagSlug
  );
  if (matchedTags.length !== 1)
    throw new Error(
      `Expected a tag (${tagSlug}), but got ${matchedTags.length}.`
    );

  const tag = matchedTags[0];

  return {
    title: `${tag.name} - ${siteTitle}`,
    description:
      siteDescription + `${tag.name}についての記事を表示しています。`,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: `${tag.name} - ${siteTitle}`,
      description:
        siteDescription + `${tag.name}についての記事を表示しています。`,
      url: tag.ref,
      siteName: siteTitle,
      images: "/images/ogp-image.jpg",
      locale: "ja_JP",
      type: "website",
    },
    twitter: {
      card: "summary",
    },
  };
}

export default async function Tag({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const tagSlug = decodeURIComponent((await params).tag);

  const posts = getAllPosts();
  const tags = aggregateTags(posts);

  const matchedTags = tags.filter(
    (tag) => tag.ref.replace("/tags/", "") === tagSlug
  );
  if (matchedTags.length !== 1)
    throw new Error(
      `Expected a tag (${tagSlug}), but got ${matchedTags.length}.`
    );

  const tag = matchedTags[0];
  const filteredPosts = filterPostsByTag(posts, tag);
  const slicedPosts = filteredPosts.slice(0, postsPerPage);

  const pages = range(1, Math.ceil(filteredPosts.length / postsPerPage) + 1);

  const postCards = slicedPosts.map((p, index) => {
    return <PostListItem key={index} post={p} />;
  });
  return (
    <div>
      {postCards}
      <Pagination
        pages={pages}
        currentPage={1}
        parentPath={`${tag.ref}/page`}
        topPath={tag.ref}
      />
    </div>
  );
}
