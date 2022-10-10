import { TagData } from "./tag";

type PostData = {
  title: string;
  date: Date;
  ref: string;
  desc: string;
  tags: TagData[];
  content: string;
};

type SerializablePostData = {
  title: string;
  date: string;
  ref: string;
  desc: string;
  tags: TagData[];
  content: string;
}

export type { PostData, SerializablePostData };
