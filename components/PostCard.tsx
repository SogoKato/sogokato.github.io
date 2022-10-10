import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Tags from "./Tags";
import type { PostData } from "../types/post";

type PostCardProps = {
  className?: string;
  post: PostData;
  isPostPage: boolean;
  isProfilePage?: boolean;
}

const PostCard: React.FC<PostCardProps> = ({ className, post, isPostPage, isProfilePage }) => {
  const date = !isProfilePage ? <p>{post.date.getFullYear()}年{post.date.getMonth() + 1}月{post.date.getDate()}日</p> : null;
  const tags = <Tags tags={post.tags}></Tags>;
  const titleClassName = "font-bold mt-3 text-4xl";
  const title = isPostPage ? <h1 className={"mb-3 " + titleClassName}>{post.title}</h1> : <h2 className={titleClassName}>{post.title}</h2>;
  const content = isPostPage ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown> : <p className="line-clamp-3 my-5 text-neutral-600 dark:text-neutral-300">{post.desc}</p>;
  const elements = isPostPage ? (
    <div>
      {date}
      {title}
      {tags}
      <div className={"my-5 " + className}>
        {content}
      </div>
      {tags}
    </div>
  ) : (
    <div>
      <a className="block" href={post.ref}>
        {date}
        {title}
        {content}
      </a>
      {tags}
    </div>
  )
  return (
    <div className="bg-white dark:bg-neutral-700 mx-auto mb-11 p-8 rounded-3xl shadow-lg w-11/12">
      {elements}
    </div>
  );
};

export default PostCard;
