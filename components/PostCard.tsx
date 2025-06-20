import dynamic from "next/dynamic";
import Script from "next/script";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";
import Tags from "./Tags";
import { type Post, type PostMeta } from "../types/post";
import Social from "./Social";

type PostCardProps = {
  className?: string;
  post: Post;
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
  const LikeButtons = dynamic(() => import("./Like"), { ssr: false });
  const shareButtons = !isStaticPostPage ? (
    <Social
      className="flex justify-end"
      path={post.ref}
      text={`${post.title}\n`}
    />
  ) : null;
  return (
    <div className="bg-white dark:bg-neutral-800 mx-auto mb-6 p-6 sm:p-8 rounded-3xl shadow-lg sm:w-11/12">
      <div>
        {date}
        <h1 className="font-bold leading-tight mb-5 mt-8 text-2xl sm:text-3xl">
          {post.title}
        </h1>
        {shareButtons}
        <div className={"mb-16 mt-8 " + className}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{ code: CodeBlock }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
        {!isStaticPostPage ? <LikeButtons path={post.ref} /> : null}
        <Tags className="mt-5" tags={post.tags}></Tags>
        <Script
          type="module"
          src="https://pyscript.net/releases/2024.11.1/core.js"
          strategy="lazyOnload"
        />
      </div>
    </div>
  );
};

export default PostCard;
