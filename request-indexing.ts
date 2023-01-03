import { orderBy } from "lodash";
import { google } from "googleapis";
import type { PostData } from "./types/post";
import { baseUrl } from "./utils/const";
import { convertSerializablePostDataToPostData } from "./utils/posts";
import { listPosts } from "./utils/readPosts";

const googleSAKey = require("./service_account.json");
const bingIndexNowKey = "8558162bf0de4b4fa018126dfc4e0cdb";

const jwtClient = new google.auth.JWT(
  googleSAKey.client_email,
  undefined,
  googleSAKey.private_key,
  ["https://www.googleapis.com/auth/indexing"],
  undefined
);

const requestGoogle = (accessToken: string, post: PostData) => {
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
    listPosts().map((post) => convertSerializablePostDataToPostData(post)),
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
  }).then((res) => console.log(res.ok));
};

requestIndexing();
