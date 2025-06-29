import { TagData } from "./tag";

interface RecommendedPost {
  title: string;
  date: Date;
  ref: string;
  filepath: string;
  desc: string;
  tags: TagData[];
  draft: boolean;
  showTerminalAside: boolean;
  reason?: string;
}

interface Post {
  title: string;
  date: Date;
  ref: string;
  filepath: string;
  desc: string;
  tags: TagData[];
  draft: boolean;
  showTerminalAside: boolean;
  content: string;
  recommendation: RecommendedPost[];
}

interface RawPost {
  metadata: {
    title: string;
    date: string;
    ref: string;
    filepath: string;
    desc: string;
    tags: TagData[];
    draft: boolean;
    showTerminalAside: boolean;
  };
  content: string;
  summary: string | null;
  embedding: number[] | null;
}

export type { Post, RawPost, RecommendedPost };
