import { Metadata } from "next";
import Ad from "../../../components/Ad";
import PostCard from "../../../components/PostCard";
import PostPagination from "../../../components/PostPagination";
import { baseUrl, siteDescription, siteTitle } from "../../../utils/const";
import { getAllPosts } from "../../../utils/readPosts";

export async function generateStaticParams() {
  const posts = getAllPosts();

  return posts.map((post) => ({
    slug: post.ref.replace("/posts/", "").split("/"),
  }));
}

type Props = {
  params: Promise<{ slug: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;

  const posts = getAllPosts();
  const post = posts.filter((p) => p.ref === `/posts/${slug.join("/")}`)[0];

  return {
    title: `${post.title} - ${siteTitle}`,
    description: post.desc,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: `${post.title} - ${siteTitle}`,
      description: post.desc,
      url: post.ref,
      siteName: siteTitle,
      images: "/images/ogp-image.jpg",
      locale: "ja_JP",
      type: "article",
    },
    twitter: {
      card: "summary",
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const slug = (await params).slug;

  const posts = getAllPosts();
  const post = posts.filter((p) => p.ref === `/posts/${slug.join("/")}`)[0];

  const currentPostIndex = posts.map((p) => p.ref).indexOf(post.ref);
  if (currentPostIndex === -1)
    throw new Error("Could not find the current post.");

  const nextPost = currentPostIndex > 0 ? posts[currentPostIndex - 1] : null;
  const prevPost =
    currentPostIndex < posts.length - 1 ? posts[currentPostIndex + 1] : null;

  return (
    <article>
      <PostCard
        className="max-w-none prose dark:prose-invert prose-pre:m-0 prose-neutral prose-pre:px-2 prose-pre:py-1"
        post={post}
      />
      <div className="flex flex-col sm:flex-row justify-between mb-4 mx-auto w-11/12">
        {nextPost ? (
          <PostPagination
            className="mb-4 sm:mb-0 w-full sm:w-1/2"
            post={nextPost}
            isNext={true}
          />
        ) : (
          <div></div>
        )}
        {prevPost ? (
          <PostPagination
            className="w-full sm:w-1/2"
            post={prevPost}
            isNext={false}
          />
        ) : (
          <div></div>
        )}
      </div>
      <Ad type="multiplex" className="mb-4 mx-auto w-11/12" />
    </article>
  );
}
