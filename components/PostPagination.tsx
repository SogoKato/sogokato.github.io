import Link from "next/link";
import type { PostData } from "../types/post";

type PostPaginationProps = {
  className?: string;
  post: PostData;
  isNext: boolean;
};

const PostPagination: React.FC<PostPaginationProps> = ({ className, post, isNext }) => {
  const className_ = "bg-duchs-200 group-hover:bg-duchs-800 font-display h-14 mx-5 first:ml-0 last:mr-0 px-4 py-2 rounded-full text-4xl text-center text-duchs-900 group-hover:text-duchs-100 transition-all w-14";
  return (
    <div className={className}>
      <Link href={post.ref}>
        <a className={"dark:hover:bg-neutral-600 hover:bg-neutral-300 flex group items-center rounded-full transition-all" + (isNext ? " pr-10" : " pl-10")}>
          {isNext ? <div className={className_}>{"<"}</div> : null}
          <div className={!isNext ? "text-end" : ""}>
            <p className="mb-1">{post.title}</p>
            <p className="text-neutral-500">{post.date.getFullYear()}年{post.date.getMonth() + 1}月{post.date.getDate()}日</p>
          </div>
          {!isNext ? <div className={className_}>{">"}</div> : null}
        </a>
      </Link>
    </div>
  );
};

export default PostPagination;
