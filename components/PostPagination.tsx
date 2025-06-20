import Link from "next/link";
import type { Post, PostMeta } from "../types/post";

type PostPaginationProps = {
  className?: string;
  post: Post | PostMeta;
  isNext: boolean;
};

const PostPagination: React.FC<PostPaginationProps> = ({
  className,
  post,
  isNext,
}) => {
  const arrowBoxClassName =
    "bg-duchs-200 group-hover:bg-duchs-800 flex items-center justify-center h-14 mx-5 first:ml-0 last:mr-0 px-3 rounded-full shrink-0 transition-all w-14";
  const svgClassName = "fill-duchs-900 group-hover:fill-duchs-100";
  const svgViewBox = "0 0 10.19 8.33";
  const arrowLeft = (
    <svg className={svgClassName} viewBox={svgViewBox}>
      <g>
        <path d="M.31,4.9c-.11-.11-.19-.23-.24-.35s-.07-.25-.07-.37c0-.13,.02-.26,.07-.38s.13-.24,.24-.35L3.45,.32c.09-.09,.19-.17,.29-.23s.22-.09,.36-.09,.27,.03,.4,.09,.24,.14,.33,.24,.17,.21,.23,.33,.08,.25,.08,.38-.03,.25-.08,.35-.13,.21-.23,.3l-.87,.89c-.11,.11-.22,.22-.34,.32s-.24,.19-.36,.28h5.99c.15,0,.29,.03,.4,.08s.22,.12,.3,.21,.14,.2,.18,.32,.06,.25,.06,.39-.02,.26-.06,.38-.1,.22-.18,.31-.18,.16-.3,.21-.25,.08-.4,.08H3.42c.12,.09,.25,.18,.37,.28s.23,.2,.34,.32l.76,.79c.1,.1,.18,.2,.23,.31s.08,.22,.08,.34c0,.14-.03,.28-.1,.41s-.15,.25-.26,.36-.22,.19-.36,.25-.27,.09-.4,.09c-.12,0-.23-.03-.34-.08s-.21-.13-.31-.23L.31,4.9Z" />
      </g>
    </svg>
  );
  const arrowRight = (
    <svg className={svgClassName} viewBox={svgViewBox}>
      <g>
        <path d="M6.77,3.16c-.12-.09-.25-.18-.37-.28s-.23-.2-.34-.32l-.76-.79c-.1-.1-.18-.2-.23-.31s-.08-.22-.08-.34c0-.14,.03-.28,.1-.41s.15-.25,.26-.36,.22-.19,.36-.25,.27-.09,.4-.09c.12,0,.23,.03,.34,.08s.21,.13,.31,.23l3.12,3.12c.11,.11,.19,.23,.24,.35s.07,.25,.07,.37c0,.13-.02,.26-.07,.38s-.13,.24-.24,.35l-3.13,3.13c-.09,.09-.19,.17-.29,.23s-.22,.09-.36,.09-.27-.03-.4-.09-.24-.14-.33-.24-.17-.21-.23-.33-.08-.25-.08-.38,.03-.25,.08-.35,.13-.21,.23-.3l.87-.89c.11-.11,.22-.22,.34-.32s.24-.19,.36-.28H.95c-.15,0-.29-.03-.4-.08s-.22-.12-.3-.21-.14-.2-.18-.32-.06-.25-.06-.39,.02-.26,.06-.38,.1-.22,.18-.31,.18-.16,.3-.21,.25-.08,.4-.08H6.77Z" />
      </g>
    </svg>
  );
  const titleClassName = "shrink";
  return (
    <div className={className}>
      <Link
        href={post.ref}
        className={
          "dark:hover:bg-neutral-600 hover:bg-neutral-300 flex group items-center rounded-full transition-all" +
          (isNext ? "" : " justify-end")
        }
      >
        {isNext ? <div className={arrowBoxClassName}>{arrowLeft}</div> : null}
        <div className={titleClassName + (!isNext ? " text-end" : "")}>
          <p className="line-clamp-1 mb-1">{post.title}</p>
          <p className="text-neutral-500">
            {post.date.getFullYear()}年{post.date.getMonth() + 1}月
            {post.date.getDate()}日
          </p>
        </div>
        {!isNext ? <div className={arrowBoxClassName}>{arrowRight}</div> : null}
      </Link>
    </div>
  );
};

export default PostPagination;
