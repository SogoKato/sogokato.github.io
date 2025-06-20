import type { ReactNode } from "react";
import Header from "./Header";
import Aside from "./Aside";
import Footer from "./Footer";
import type { SerializablePost, SerializablePostMeta } from "../types/post";

type LayoutProps = {
  children?: ReactNode | undefined;
  posts?: SerializablePostMeta[];
  post?: SerializablePost;
};

export default function Layout({ children, posts, post }: LayoutProps) {
  return (
    <div className="duration-400 min-h-screen text-neutral-900 dark:text-neutral-50 transition-all">
      <div className="grid grid-cols-10 justify-center max-w-7xl mx-auto">
        <Header className="col-span-10" />
        <main className="col-span-10 md:col-span-7">{children}</main>
        <Aside
          className="col-span-10 md:col-span-3"
          posts={posts ? posts : []}
          post={post}
        />
        <Footer className="col-span-10" />
      </div>
    </div>
  );
}
