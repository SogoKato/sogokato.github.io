import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Tags from "./Tags";
import type { PostData } from "../types/post";

type PostCardProps = {
  className?: string;
  post: PostData;
  isPostPage: boolean;
  isStaticPostPage?: boolean;
}

const PostCard: React.FC<PostCardProps> = ({ className, post, isPostPage, isStaticPostPage }) => {
  const date = !isStaticPostPage ? <p>{post.date.getFullYear()}年{post.date.getMonth() + 1}月{post.date.getDate()}日</p> : null;
  const tagsStart = <Tags className="mb-1" tags={post.tags}></Tags>;
  const tagsEnd = <Tags className="mt-3" tags={post.tags}></Tags>;
  const titleClassName = "font-bold mt-3 text-4xl";
  const title = isPostPage ? <h1 className={"mb-3 " + titleClassName}>{post.title}</h1> : <h2 className={titleClassName}>{post.title}</h2>;
  const content = isPostPage ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown> : <p className="line-clamp-3 my-5 text-neutral-600 dark:text-neutral-300">{post.desc}</p>;
  const LikeButtons = dynamic(() => import("./Like"), { ssr: false });
  const SocialButtons = dynamic(() => import("./Social"), { ssr: false });
  const shareButtons = !isStaticPostPage ? <SocialButtons className="flex" path={post.ref} /> : null;
  const elements = isPostPage ? (
    <div>
      {date}
      {title}
      {tagsStart}
      {shareButtons}
      <div className={"my-5 " + className}>
        {content}
      </div>
      {!isStaticPostPage ? <LikeButtons path={post.ref} /> : null}
      {shareButtons}
      {tagsEnd}
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
  )
  return (
    <div className="bg-white dark:bg-neutral-700 mx-auto mb-11 p-8 rounded-3xl shadow-lg w-11/12">
      {elements}
    </div>
  );
};

export default PostCard;
