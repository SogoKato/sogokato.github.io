import { TagData } from "./tag";

type PostData = {
  title: string;
  date: Date;
  ref: string;
  desc: string;
  tags: TagData[];
  content: string;
  draft: boolean;
  showTerminalAside: boolean;
};

type SerializablePostData = {
  title: string;
  date: string;
  ref: string;
  desc: string;
  tags: TagData[];
  content: string;
  draft: boolean;
  showTerminalAside: boolean;
}

export type { PostData, SerializablePostData };
