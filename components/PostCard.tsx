import dynamic from "next/dynamic";
import Script from "next/script";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";
import Tags from "./Tags";
import { isPostData, type PostData, type PostSummary } from "../types/post";
import Social from "./Social";

type PostCardProps = {
  className?: string;
  post: PostData | PostSummary;
  isStaticPostPage?: boolean;
};

const PostCard: React.FC<PostCardProps> = ({
  className,
  post,
  isStaticPostPage,
}) => {
  const date = !isStaticPostPage ? (
    <p className="text-neutral-600 dark:text-neutral-300">
      {post.date.getFullYear()}年{post.date.getMonth() + 1}月
      {post.date.getDate()}日
    </p>
  ) : null;
  const tagsEnd = <Tags className="mt-5" tags={post.tags}></Tags>;
  const titleClassName = "font-bold leading-tight mb-5 text-2xl sm:text-3xl";
  const isPostPage = isPostData(post);
  const title = isPostPage ? (
    <h1 className={"mt-8 " + titleClassName}>{post.title}</h1>
  ) : (
    <h2 className={"mt-5 " + titleClassName}>{post.title}</h2>
  );
  const content = isPostPage ? (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{ code: CodeBlock }}
    >
      {post.content}
    </ReactMarkdown>
  ) : (
    <p className="line-clamp-3 my-5 text-neutral-600 dark:text-neutral-300">
      {post.desc}
    </p>
  );
  const LikeButtons = dynamic(() => import("./Like"), { ssr: false });
  const shareButtons = !isStaticPostPage ? (
    <Social
      className="flex justify-end"
      path={post.ref}
      text={`${post.title}\n`}
    />
  ) : null;
  const elements = isPostPage ? (
    <div>
      {date}
      {title}
      {shareButtons}
      <div className={"mb-16 mt-8 " + className}>{content}</div>
      {!isStaticPostPage ? <LikeButtons path={post.ref} /> : null}
      {tagsEnd}
      <Script
        type="module"
        src="https://pyscript.net/releases/2024.11.1/core.js"
        strategy="lazyOnload"
      />
    </div>
  ) : (
    <div>
      <a className="block" href={post.ref}>
        {date}
        {title}
        {content}
      </a>
      {tagsEnd}
    </div>
  );
  const rootClassNameBase =
    "bg-white dark:bg-neutral-800 mx-auto mb-6 p-6 sm:p-8 shadow-lg sm:w-11/12";
  const rootClassName = isPostPage
    ? "rounded-3xl " + rootClassNameBase
    : "rounded-t-3xl sm:rounded-3xl " + rootClassNameBase;
  return <div className={rootClassName}>{elements}</div>;
};

export default PostCard;
