import { TagData } from "./tag";

interface PostSummary {
  title: string;
  date: Date;
  ref: string;
  filepath: string;
  desc: string;
  embedding: number[] | null;
  tags: TagData[];
  draft: boolean;
  showTerminalAside: boolean;
}

interface PostData extends PostSummary {
  content: string;
}

interface SerializablePostSummary {
  title: string;
  date: string;
  ref: string;
  filepath: string;
  desc: string;
  embedding: number[] | null;
  tags: TagData[];
  draft: boolean;
  showTerminalAside: boolean;
}

interface SerializablePostData extends SerializablePostSummary {
  content: string;
}

const isPostData = (arg: unknown): arg is PostData => {
  return (
    typeof arg === "object" &&
    arg !== null &&
    typeof (arg as PostData).content === "string"
  );
};

export { isPostData };
export type {
  PostData,
  PostSummary,
  SerializablePostData,
  SerializablePostSummary,
};
