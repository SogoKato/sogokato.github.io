import { TagData } from "./tag";

/*
 * ビルド成果物で使用される投稿データ型
 * - PostMeta: 記事の概要
 * - RecommendedPost: おすすめされる記事
 * - PostData: 記事本体
 * - SerializablePostMeta: シリアライズ可能な記事の概要
 * - SerializablePostMeta: シリアライズ可能なおすすめされる記事
 * - SerializablePostData: シリアライズ可能な記事本体
 */

interface PostMeta {
  title: string;
  date: Date;
  ref: string;
  filepath: string;
  desc: string;
  tags: TagData[];
  draft: boolean;
  showTerminalAside: boolean;
}

interface RecommendedPost extends PostMeta {
  reason?: string;
}

interface Post extends PostMeta {
  content: string;
  recommendation: RecommendedPost[];
}

interface SerializablePostMeta {
  title: string;
  date: string;
  ref: string;
  filepath: string;
  desc: string;
  tags: TagData[];
  draft: boolean;
  showTerminalAside: boolean;
}

interface SerializableRecommendedPost extends SerializablePostMeta {
  reason?: string;
}

interface SerializablePost extends SerializablePostMeta {
  content: string;
  recommendation: SerializableRecommendedPost[];
}

/*
 * ビルドで使用される投稿データ型
 * - RawPost: 未変換の記事データ
 */

interface RawPost {
  metadata: SerializablePostMeta;
  content: string;
  summary: string | null;
  embedding: number[] | null;
}

export type {
  RawPost,
  RecommendedPost,
  Post,
  PostMeta,
  SerializablePost,
  SerializablePostMeta,
  SerializableRecommendedPost,
};
