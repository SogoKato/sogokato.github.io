import fs from "fs";
import matter from "gray-matter";
import PostCard from "../../components/PostCard";
import { baseUrl, siteDescription, siteTitle } from "../../utils/const";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const fileContent = fs.readFileSync("README.md", "utf-8");
  const { data } = matter(fileContent);

  return {
    title: `${data.title} - ${siteTitle}`,
    description: siteDescription,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: `${data.title} - ${siteTitle}`,
      description: siteDescription,
      url: "/profile",
      siteName: siteTitle,
      images: "/images/ogp-image.jpg",
      locale: "ja_JP",
      type: "profile",
    },
    twitter: {
      card: "summary",
    },
  };
}

export default async function Profile() {
  const fileContent = fs.readFileSync("README.md", "utf-8");
  const { data, content } = matter(fileContent);

  const post = {
    title: data.title,
    date: new Date(),
    ref: "",
    filepath: "",
    desc: "",
    embedding: null,
    draft: false,
    content: content,
    tags: [],
    showTerminalAside: false,
    recommendation: [],
  };

  return (
    <article>
      <PostCard
        className="max-w-none prose dark:prose-invert prose-pre:m-0 prose-neutral prose-pre:px-2 prose-pre:py-1"
        post={post}
        isStaticPostPage={true}
      />
    </article>
  );
}
