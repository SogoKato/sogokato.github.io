import Image from "next/image";
import Link from "next/link";
import Tags from "./Tags";
import type { Post } from "../types/post";
import { aggregateTags } from "../utils/tag";
import { recommendPostsGlobal } from "../utils/recommend";
import Ad from "./Ad";
import AsideTerminal from "./AsideTerminal";
import Recommendation from "./Recommendation";

type AsideProps = {
  className?: string;
  posts: Post[];
};

const Aside: React.FC<AsideProps> = ({ className, posts }) => {
  const commonClassName = "mx-auto w-11/12 ";

  const globalRecommendation = recommendPostsGlobal(posts);

  const recommended = (
    <Recommendation
      posts={posts}
      defaultRecommendation={globalRecommendation}
    />
  );

  const terminal = <AsideTerminal posts={posts} className={commonClassName} />;

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
  const tags = aggregateTags(posts);
  const adSenseClassName = terminal === null ? " mb-8 sticky top-8" : " mb-8";
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
          元クラウド屋、いま AI
          屋。手を動かさなくてよくなるように全力で手を動かしてます。
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
      <Ad type="display" className={commonClassName + "mb-8"} />
      <div className={commonClassName + "mb-8"}>
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">
          TAGS
        </h2>
        <Tags className="mt-3.5" tags={tags} />
      </div>
      <div className={commonClassName + "mb-8"}>
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">
          LINKS
        </h2>
        <Link
          href="/feed.xml"
          className="block mb-1 mt-3.5 hover:opacity-75 transition-all"
        >
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
      <Ad type="display" className={commonClassName + adSenseClassName} />
    </aside>
  );
};

export default Aside;
