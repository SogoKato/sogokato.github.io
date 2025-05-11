import fs from "fs";
import { escape, orderBy } from "lodash";
import { join } from "path";
import type { PostSummary } from "./types/post";
import { baseUrl, siteDescription, siteTitle } from "./utils/const";
import { convertSerializablePostSummaryToPostSummary } from "./utils/posts";
import { listPostSummaries } from "./utils/readPosts";

const RSS_URL = `${baseUrl}/feed.xml`;

const escapeHTML = (s: string): string => {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const createFeed = (post: PostSummary) => {
  const title = escapeHTML(post.title);
  const desc = escapeHTML(post.desc);
  return `    <item>
      <title>${title}</title>
      <link>${baseUrl}${post.ref}</link>
      <guid>${baseUrl}${post.ref}</guid>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <description>${desc}</description>
    </item>`;
};

const writeRss = async (filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, "utf-8");
  } catch (err) {
    console.error(err);
  }
};

const generateRss = async () => {
  const posts = orderBy(
    listPostSummaries().map((post) =>
      convertSerializablePostSummaryToPostSummary(post)
    ),
    (o) => o.date,
    "desc"
  );
  const lastBuildDate = posts[0].date.toUTCString();
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

  const filePath = join(process.cwd(), "out/feed.xml");

  await writeRss(filePath, rss);
};

generateRss();
