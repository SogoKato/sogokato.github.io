import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import Tags from "./Tags";
import type { PostSummary, SerializablePostData, SerializablePostSummary } from "../types/post";
import { convertSerializablePostSummaryToPostSummary } from "../utils/posts";
import { aggregateTags } from "../utils/tag";
import { useEffect } from "react";

type AsideProps = {
  className?: string;
  posts: SerializablePostData[];
  post: SerializablePostData | undefined;
};

const Aside: React.FC<AsideProps> = ({ className, posts, post }) => {
  const commonClassName = "mx-auto w-11/12 ";
  const posts_ = posts.map((serializedPost) =>
    convertSerializablePostSummaryToPostSummary(serializedPost)
  );
  useEffect(() => {
    const el = document.getElementById("sidebarPyTerminalWrapper");
    if (!el) return;
    el.style.setProperty("--terminal-height", "9999px");
  }, []);
  // TODO: おすすめの記事や人気の記事を出すようにする
  const recommendedPosts = recommendPostsFromPost(posts, post);
  const recommended = recommendedPosts.map((post, index) => {
    return (
      <Link
        href={post.ref}
        key={index}
        className="block mb-3 hover:opacity-75 transition-all"
      >
        <p className="mb-1 text-xs">{post.title}</p>
        <p className="text-neutral-500 text-xs">
          {post.date.getFullYear()}年{post.date.getMonth() + 1}月
          {post.date.getDate()}日
        </p>
      </Link>
    );
  });
  let terminal = null;
  if (post?.showTerminalAside) {
    const PyTerminal = dynamic(() => import("./PyTerminal"), { ssr: false });
    terminal = (
      <div className="sidebar-terminal-container md:sticky md:top-0 py-8 z-10">
        <div className={commonClassName + "sidebar-terminal-inner-container"}>
          <div className="flex justify-between">
            <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">
              TERMINAL
            </h2>
            <button
              className="bg-duchs-200 hover:bg-duchs-800 font-display px-2 rounded-full text-duchs-900 hover:text-duchs-100 text-xs transition-all"
              onClick={() => {
                const el = document.getElementById("sidebarPyTerminalWrapper");
                if (!el) {
                  console.error("#sidebarPyTerminalWrapper not found.");
                  return;
                }
                const current = el.style.getPropertyValue("--terminal-height");
                const changed = current === "0px" ? "9999px" : "0px";
                el.style.setProperty("--terminal-height", changed);
              }}
            >
              OPEN/CLOSE
            </button>
          </div>
          <pre
            id="sidebarPyTerminalWrapper"
            className={"duration-300 text-xs transition-all"}
            style={{
              maxHeight: "var(--terminal-height)",
            }}
          >
            <PyTerminal
              id="sidebarPyTerminal"
              className="my-3.5"
              descStyle={{
                display: "block",
                marginTop: "0.625rem",
                whiteSpace: "pre-wrap",
              }}
              linkStyle={{ textDecoration: "underline", cursor: "pointer" }}
            />
          </pre>
        </div>
        <style>{`
        .sidebar-terminal-container::after {
          display: block;
          height: 100%;
          width: 100%;
          position: absolute;
          top: 0;
          z-index: -1;
          mask: linear-gradient(to top, transparent, black 20px);
          backdrop-filter: blur(8px);
        }
        .sidebar-terminal-inner-container {
          max-height: calc(100vh - 4rem);
          overflow: scroll;
        }
        .sidebar-terminal-container .py-terminal {
          border-radius: 0.375rem;
          padding: 0.75rem;
        }
        `}</style>
        <style
          dangerouslySetInnerHTML={{
            __html: '.sidebar-terminal-container::after {content: ""}',
          }}
        ></style>
      </div>
    );
  }
  const arrowTopRight = (
    <svg
      className="fill-neutral-900 dark:fill-neutral-100 h-3 ml-2"
      viewBox="0 0 7.82 7.82"
    >
      <g>
        <path d="M4.41,2.01c-.15,.02-.3,.04-.46,.06s-.31,.02-.46,.01l-1.1-.02c-.14,0-.27-.02-.38-.06s-.21-.1-.3-.19c-.1-.1-.17-.22-.22-.36s-.07-.29-.07-.44c0-.15,.02-.29,.07-.43s.12-.26,.22-.35c.09-.09,.18-.15,.29-.18S2.24,0,2.39,0H6.8c.15,0,.29,.03,.41,.08s.23,.12,.31,.21c.09,.09,.17,.2,.22,.32s.08,.26,.08,.41V5.46c0,.13-.02,.26-.05,.37s-.09,.22-.19,.31-.21,.17-.35,.22-.27,.07-.4,.07-.27-.03-.4-.07-.24-.12-.33-.21-.15-.19-.19-.31-.05-.24-.05-.38l-.02-1.24c0-.16,0-.31,.02-.46s.03-.3,.06-.46L1.7,7.53c-.11,.11-.22,.18-.34,.23s-.24,.07-.36,.06-.24-.04-.35-.09-.22-.13-.32-.23-.17-.2-.23-.31S0,6.95,0,6.83s.01-.24,.06-.36,.12-.23,.23-.34L4.41,2.01Z" />
      </g>
    </svg>
  );
  const tags = aggregateTags(posts_);
  return (
    <aside className={className}>
      {terminal}
      <div className={commonClassName + "mb-8"}>
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">
          AUTHOR
        </h2>
        <div className="flex items-center my-3.5">
          <div className="mr-2.5">
            <Image
              className="rounded-full"
              src="/images/icon.png"
              alt="アイコン"
              width="80"
              height="80"
            />
          </div>
          <div>
            <p className="font-black font-display mb-2 text-duchs-900 dark:text-duchs-100 text-lg">
              Sogo Kato
            </p>
            <div className="flex">
              <Link
                href="https://github.com/SogoKato"
                className="mr-2 hover:opacity-75 transition-all"
                target="_blank"
              >
                <div className="dark:hidden">
                  <Image
                    width="20"
                    height="20"
                    alt="GitHubアイコン"
                    src="/images/github-light.svg"
                  />
                </div>
                <div className="hidden dark:block">
                  <Image
                    width="20"
                    height="20"
                    alt="GitHubアイコン"
                    src="/images/github-dark.svg"
                  />
                </div>
              </Link>
            </div>
          </div>
        </div>
        <p className="mb-2.5 text-xs">
          クラウド業界に生息する駆け出しへっぽこエンジニア。ラズパイとダックスがすき。資格たくさんほしいので余ってる人はお裾分けください。
        </p>
        <Link href="/profile">
          <button className="bg-duchs-200 hover:bg-duchs-800 font-black font-display px-3.5 py-0.5 rounded-full text-duchs-900 hover:text-duchs-100 transition-all">
            MORE
          </button>
        </Link>
      </div>
      <div className={commonClassName + "mb-8"}>
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">
          RECOMMENDED
        </h2>
        <ul className="mt-3.5">{recommended}</ul>
      </div>
      <div className={commonClassName + "mb-8"}>
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">
          TAGS
        </h2>
        <Tags className="mt-3.5" tags={tags} />
      </div>
      <div className={commonClassName}>
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">
          LINKS
        </h2>
        <Link href="/feed.xml" className="block mb-1 mt-3.5 hover:opacity-75 transition-all">
          <p>RSS</p>
        </Link>
        <Link
          href="https://github.com/SogoKato/sogokato.github.io"
          className="block mb-1 hover:opacity-75 transition-all"
          target="_blank"
        >
          <p className="flex items-center">GitHub {arrowTopRight}</p>
        </Link>
      </div>
    </aside>
  );
};

const recommendPostsFromPost = (
  posts_: SerializablePostData[],
  post: SerializablePostSummary | undefined
): PostSummary[] => {
  const posts = posts_.map((serializedPost) =>
    convertSerializablePostSummaryToPostSummary(serializedPost)
  );
  // Recommend the latest five posts if `post` is undefined.
  if (!post) {
    posts.splice(5, posts.length - 5);
    return posts;
  }
  const tagNames = post.tags.map((tag) => tag.name);
  const postsWithSameTag = posts.filter((otherPost) => {
    if (otherPost.ref === post.ref) return false;
    for (let i = 0; i < otherPost.tags.length; i++) {
      if (tagNames.includes(otherPost.tags[i].name)) {
        return true;
      }
    }
    return false;
  });
  // Recommend the latest five posts which have the same tag.
  if (postsWithSameTag.length >= 5) {
    postsWithSameTag.splice(5, postsWithSameTag.length - 5);
    return postsWithSameTag;
  }
  // Recommend the posts with the same tag.
  // Fill with the latest posts which don't have the same tag.
  const postsWithSameTagAndLatestPosts = posts.reduce(
    (accumulator, otherPost) => {
      if (accumulator.length >= 5) return accumulator;
      for (let i = 0; i < otherPost.tags.length; i++) {
        if (tagNames.includes(otherPost.tags[i].name)) {
          return accumulator;
        }
      }
      accumulator.push(otherPost);
      return accumulator;
    },
    postsWithSameTag
  );
  return postsWithSameTagAndLatestPosts;
};

export default Aside;
