import Image from "next/image";
import Link from "next/link";
import Tags from "./Tags";
import type { SerializablePostData } from "../types/post";
import { convertSerializablePostDataToPostData } from "../utils/posts";
import { aggregateTags } from "../utils/tag";

type AsideProps = {
  className?: string;
  posts: SerializablePostData[];
};

const Aside: React.FC<AsideProps> = ({ className, posts }) => {
  const posts_ = posts.map(serializedPost => convertSerializablePostDataToPostData(serializedPost));
  // TODO: おすすめの記事や人気の記事を出すようにする
  const recommendedPosts = posts_.filter((post, index) => {
    if (index < 5) return post;
  });
  const recommended = recommendedPosts.map((post, index) => {
    return (
      <Link href={post.ref} key={index}>
        <a className="block mb-3 hover:opacity-75 transition-all">
          <p className="mb-1 text-xs">{post.title}</p>
          <p className="text-neutral-500 text-xs">{post.date.getFullYear()}年{post.date.getMonth() + 1}月{post.date.getDate()}日</p>
        </a>
      </Link>
    );
  });
  const tags = aggregateTags(posts_);
  return (
    <aside className={className}>
      <div className="mb-8">
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">AUTHOR</h2>
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
            <p className="font-black font-display mb-2 text-duchs-900 dark:text-duchs-100 text-lg">Sogo Kato</p>
            <div className="flex">
              <Link href="https://github.com/SogoKato">
                <a className="mr-2 hover:opacity-75 transition-all" target="_blank">
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
                </a>
              </Link>
            </div>
          </div>
        </div>
        <p className="mb-2.5 text-xs">クラウド業界に生息する駆け出しへっぽこエンジニア。ラズパイとダックスがすき。資格たくさんほしいので余ってる人はお裾分けください。</p>
        <Link href="/profile">
          <a>
            <button className="bg-duchs-200 hover:bg-duchs-800 font-black font-display px-3.5 py-0.5 rounded-full text-duchs-900 hover:text-duchs-100 transition-all">MORE</button>
          </a>
        </Link>
      </div>
      <div className="mb-8">
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">RECOMMENDED</h2>
        <ul className="mt-3.5">
          {recommended}
        </ul>
      </div>
      <div>
        <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">TAGS</h2>
        <Tags className="mt-3.5" tags={tags} />
      </div>
    </aside>
  );
};

export default Aside;
