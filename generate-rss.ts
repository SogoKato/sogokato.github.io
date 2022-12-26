import fs from "fs";
import { orderBy } from "lodash";
import { join } from "path";
import type { PostData } from "./types/post";
import { baseUrl, siteDescription, siteTitle } from "./utils/const";
import { convertSerializablePostDataToPostData } from "./utils/posts";
import { listPosts } from "./utils/readPosts";

const RSS_URL = `${baseUrl}/feed.xml`;

const createFeed = (post: PostData) => {
  const desc = post.desc.replace("&", "&amp;")
  return `    <item>
      <title>${post.title}</title>
      <link>${baseUrl}${post.ref}</link>
      <guid>${baseUrl}${post.ref}</guid>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <description>${desc}</description>
    </item>`;}

const writeRss = async (filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, "utf-8");
  } catch (err) {
    console.error(err);
  }
};

const generateRss = async () => {
  const posts = orderBy(
    listPosts().map((post) => convertSerializablePostDataToPostData(post)),
    (o) => o.date,
    "desc"
  );
  const lastBuildDate = posts.slice(-1)[0].date.toUTCString();
  const feeds = posts.map((post) => createFeed(post));

  const rss = `<?xml version="1.0" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteTitle}</title>
    <link>${baseUrl}</link>
    <description>${siteDescription}</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${RSS_URL}" rel="self" type="application/rss+xml" />
${feeds.join("\n")}
  </channel>
</rss>`;

  const filePath = join(process.cwd(), "docs/feed.xml");

  await writeRss(filePath, rss);
};

generateRss();
