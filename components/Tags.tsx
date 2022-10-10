import Tag from "./Tag";
import type { TagData } from "../types/tag";

type TagsProps = {
  className?: string;
  tags: TagData[];
};

const Tags: React.FC<TagsProps> = ({ className, tags }) => {
  const elements = tags.map(tag => {
    return (
      <Tag key={tag.name} name={tag.name} href={tag.ref}></Tag>
    )
  });
  return (
    <ul className={"flex flex-wrap " + className}>
      {elements}
    </ul>
  );
};

export default Tags;
