import { orderBy } from "lodash";
import { google } from "googleapis";
import type { PostMeta } from "./types/post";
import { baseUrl } from "./utils/const";
import { getRawPosts } from "./utils/readPosts";
import {
  convertRawPostToSerializablePostMeta,
  convertSerializablePostMetaToPostMeta,
} from "./utils/posts";

const bingIndexNowKey = "8558162bf0de4b4fa018126dfc4e0cdb";

const jwtClient = new google.auth.JWT(
  process.env.GOOGLE_SA_CLIENT_EMAIL,
  undefined,
  process.env.GOOGLE_SA_PRIVATE_KEY,
  ["https://www.googleapis.com/auth/indexing"],
  undefined
);

const requestGoogle = (accessToken: string, post: PostMeta) => {
  fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      url: `${baseUrl}${post.ref}`,
      type: "URL_UPDATED",
    }),
  })
    .then((res) => res.json())
    .then((json) => console.log(json));
};

const requestIndexing = () => {
  const posts = orderBy(
    getRawPosts().map((post) =>
      convertSerializablePostMetaToPostMeta(
        convertRawPostToSerializablePostMeta(post)
      )
    ),
    (o) => o.date,
    "desc"
  );
  // Google
  jwtClient.authorize(function (err, tokens) {
    if (err) {
      console.error(err);
      return;
    }
    if (!tokens) {
      console.error("Empty token(s).");
      return;
    }
    posts.forEach((post) => requestGoogle(tokens.access_token ?? "", post));
  });
  // Bing
  fetch("https://www.bing.com/indexnow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      host: baseUrl,
      key: bingIndexNowKey,
      keyLocation: `${baseUrl}/${bingIndexNowKey}.txt`,
      urlList: posts.map((post) => `${baseUrl}${post.ref}`),
    }),
  }).then((res) => {
    console.log(
      `The request to Bing IndexNow API ${
        res.ok ? "succeeded" : "failed"
      } with status code ${res.status}.`
    );
  });
};

requestIndexing();
