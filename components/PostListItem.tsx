import Tags from "./Tags";
import { type PostMeta } from "../types/post";

type PostListItemProps = {
  post: PostMeta;
};

const PostListItem: React.FC<PostListItemProps> = ({ post }) => {
  return (
    <div className="bg-white dark:bg-neutral-800 mx-auto mb-6 p-6 sm:p-8 rounded-t-3xl sm:rounded-3xl shadow-lg sm:w-11/12">
      <div>
        <a className="block" href={post.ref}>
          <p className="text-neutral-600 dark:text-neutral-300">
            {post.date.getFullYear()}年{post.date.getMonth() + 1}月
            {post.date.getDate()}日
          </p>
          <h2 className="font-bold leading-tight mb-5 mt-5 text-2xl sm:text-3xl">
            {post.title}
          </h2>
          <p className="line-clamp-3 my-5 text-neutral-600 dark:text-neutral-300">
            {post.desc}
          </p>
        </a>
        <Tags className="mt-5" tags={post.tags} />
      </div>
    </div>
  );
};

export default PostListItem;
