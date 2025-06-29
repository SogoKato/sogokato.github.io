"use client";

import Link from "next/link";
import { Post, RecommendedPost } from "../types/post";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type RecommendationProps = {
  posts: Post[];
  defaultRecommendation: RecommendedPost[];
};

const Recommendation: React.FC<RecommendationProps> = ({
  posts,
  defaultRecommendation,
}) => {
  const pathname = usePathname();
  const [post, setPost] = useState<Post>();

  useEffect(() => {
    if (pathname === null) return;
    setPost(posts.filter((p) => p.ref === pathname)[0]);
  }, [pathname, posts]);

  const recommendation = post ? post.recommendation : defaultRecommendation;

  return recommendation.map((recommendedPost, index) => {
    const reason = recommendedPost.reason ? (
      <span className="ml-2">[{recommendedPost.reason}]</span>
    ) : null;
    return (
      <Link
        href={recommendedPost.ref}
        key={index}
        className="block mb-3 hover:opacity-75 transition-all"
      >
        <p className="mb-1 text-xs">{recommendedPost.title}</p>
        <p className="line-clamp-1 text-neutral-500 text-xs">
          {recommendedPost.date.getFullYear()}年
          {recommendedPost.date.getMonth() + 1}月
          {recommendedPost.date.getDate()}日{reason}
        </p>
      </Link>
    );
  });
};

export default Recommendation;
