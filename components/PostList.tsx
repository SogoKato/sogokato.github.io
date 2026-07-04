import PostListItem from "./PostListItem";
import PostListAd from "./PostListAd";
import { type Post } from "../types/post";
import { postsPerPage } from "../utils/const";

type PostListProps = {
  posts: Post[];
};

const adPosition = Math.floor(postsPerPage / 2);

const PostList: React.FC<PostListProps> = ({ posts }) => {
  const items: React.ReactNode[] = [];

  posts.forEach((post, index) => {
    items.push(<PostListItem key={index} post={post} />);
    if (index === adPosition - 1) {
      items.push(<PostListAd key="ad" />);
    }
  });

  return <>{items}</>;
};

export default PostList;
