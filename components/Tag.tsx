type TagProps = {
  name: string;
  href: string;
};

const Tag: React.FC<TagProps> = ({ name, href }) => {
  return (
    <a
      className="bg-duchs-100 hover:bg-duchs-500 font-bold mb-2 mr-3 px-5 py-1 rounded-full dark:text-neutral-900 hover:text-neutral-50 hover:dark:text-neutral-50 text-xs transition-all"
      href={href}
    ># {name}</a>
  );
};

export default Tag;
