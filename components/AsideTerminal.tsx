"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Post } from "../types/post";
import { usePathname } from "next/navigation";

type AsideTerminalProps = {
  posts: Post[];
  className?: string;
};

const AsideTerminal: React.FC<AsideTerminalProps> = ({ posts, className }) => {
  const pathname = usePathname();
  const [post, setPost] = useState<Post>();

  useEffect(() => {
    if (pathname === null) return;
    setPost(posts.filter((p) => p.ref === pathname)[0]);
  }, [pathname, posts]);

  useEffect(() => {
    const el = document.getElementById("sidebarPyTerminalWrapper");
    if (!el) return;
    el.style.setProperty("--terminal-height", "9999px");
  }, []);

  if (!post?.showTerminalAside) return null;

  const PyTerminal = dynamic(() => import("./PyTerminal"), { ssr: false });

  return (
    <div className="sidebar-terminal-container md:sticky md:top-0 py-8 z-10">
      <div className={className + "sidebar-terminal-inner-container"}>
        <div className="flex justify-between">
          <h2 className="font-black font-display text-duchs-900 dark:text-duchs-100 text-xl">
            TERMINAL
          </h2>
          <button
            className="bg-duchs-200 hover:bg-duchs-800 font-display px-2 rounded-full text-duchs-900 hover:text-duchs-100 text-xs transition-all"
            onClick={() => {
              const el = document.getElementById("sidebarPyTerminalWrapper");
              if (!el) {
                console.error("#sidebarPyTerminalWrapper not found.");
                return;
              }
              const current = el.style.getPropertyValue("--terminal-height");
              const changed = current === "0px" ? "9999px" : "0px";
              el.style.setProperty("--terminal-height", changed);
            }}
          >
            OPEN/CLOSE
          </button>
        </div>
        <pre
          id="sidebarPyTerminalWrapper"
          className={"duration-300 text-xs transition-all"}
          style={{
            maxHeight: "var(--terminal-height)",
          }}
        >
          <PyTerminal
            id="sidebarPyTerminal"
            className="my-3.5"
            descStyle={{
              display: "block",
              marginTop: "0.625rem",
              whiteSpace: "pre-wrap",
            }}
            linkStyle={{ textDecoration: "underline", cursor: "pointer" }}
          />
        </pre>
      </div>
      <style>{`
        .sidebar-terminal-container::after {
          display: block;
          height: 100%;
          width: 100%;
          position: absolute;
          top: 0;
          z-index: -1;
          mask: linear-gradient(to top, transparent, black 20px);
          backdrop-filter: blur(8px);
        }
        .sidebar-terminal-inner-container {
          max-height: calc(100vh - 4rem);
          overflow: scroll;
        }
        .sidebar-terminal-container .py-terminal {
          border-radius: 0.375rem;
          padding: 0.75rem;
        }
        `}</style>
      <style
        dangerouslySetInnerHTML={{
          __html: '.sidebar-terminal-container::after {content: ""}',
        }}
      ></style>
    </div>
  );
};

export default AsideTerminal;
