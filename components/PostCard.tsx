import Script from "next/script";
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
  const shareButtons = !isStaticPostPage ? <div className="flex">{twitterShareButton}{hatenaShareButton}</div> : null;
  const elements = isPostPage ? (
    <div>
      {date}
      {title}
      {tagsStart}
      {shareButtons}
      <div className={"my-5 " + className}>
        {content}
      </div>
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

const twitterShareButton = (
  <div className="mr-2">
    <a href="https://twitter.com/share?ref_src=twsrc%5Etfw" className="twitter-share-button" data-show-count="false">Tweet</a>
    <Script async src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" />
  </div>
);

const hatenaShareButton = (
  <div className="mr-2">
    <a href="https://b.hatena.ne.jp/entry/" className="hatena-bookmark-button" data-hatena-bookmark-layout="basic-label-counter" data-hatena-bookmark-lang="ja" title="このエントリーをはてなブックマークに追加">
      <img src="https://b.st-hatena.com/images/v4/public/entry-button/button-only@2x.png" alt="このエントリーをはてなブックマークに追加" width="20" height="20" style={{border: "none"}} />
    </a>
    <Script async type="text/javascript" src="https://b.st-hatena.com/js/bookmark_button.js" />
  </div>
)

export default PostCard;
