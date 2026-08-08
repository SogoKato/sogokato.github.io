import crypto from "crypto";
import fs from "fs";
import { ChatOpenAI } from "@langchain/openai";
import {
  InferenceClient,
  type FeatureExtractionOutput,
} from "@huggingface/inference";
import { loadSummaryIndex, saveSummaryIndex } from "./utils/vectorIndex";
import { RawPost } from "./types/post";
import { getRawPosts } from "./utils/readPosts";

// Client errors will never succeed on a retry, so fail fast on them.
const noRetryStatuses = [400, 401, 402, 403, 404, 405, 406, 407, 409];

const statusOf = (e: unknown) =>
  typeof e === "object" && e !== null && "httpResponse" in e
    ? (e.httpResponse as { status?: number }).status
    : undefined;

// The inference API returns 503 while a model is still loading, so retry.
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 6) => {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = statusOf(e);
      if (status !== undefined && noRetryStatuses.includes(status)) throw e;
      if (i >= maxRetries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
};

const isEmbeddings = (out: FeatureExtractionOutput): out is number[][] =>
  out.every((v) => Array.isArray(v) && v.every((n) => typeof n === "number"));

const embedPosts = async (posts: RawPost[]): Promise<RawPost[]> => {
  // needs HUGGINGFACEHUB_API_KEY to be set
  const client = new InferenceClient(process.env.HUGGINGFACEHUB_API_KEY);

  const docs = posts
    .map((p) => p.summary)
    .filter((p) => p !== null)
    .map((p) => p.replace(/\n/g, " "));
  if (docs.length === 0) return posts;

  const embeddings = await withRetry(() =>
    client.featureExtraction({
      model: "intfloat/multilingual-e5-large",
      inputs: docs,
    }),
  );
  if (!isEmbeddings(embeddings))
    throw new Error("Unexpected feature extraction output.");

  return posts.map((post, i) => ({
    ...post,
    embedding: embeddings[i],
  }));
};

export type SummaryIndex = {
  [ref: string]: {
    fileHash: string;
    embedding: number[];
    summary: string;
  };
};

const getFileHash = (path: string) => {
  const b = fs.readFileSync(path);
  const hash = crypto.createHash("md5");
  hash.update(new Uint8Array(b));
  return hash.digest("base64");
};

const summarize = async (post: RawPost) => {
  // needs OPENAI_API_KEY to be set
  const llm = new ChatOpenAI({
    model: "gpt-4.1",
    maxTokens: 512,
  });
  const res = await llm.invoke(
    `この記事を日本語で512 tokens以内で要約してください。\n\n---\n\n# ${post.metadata.title}\n\n${post.content}`,
  );
  console.log(res.usage_metadata?.output_tokens);
  return res.text;
};

const vectorize = async () => {
  const index = loadSummaryIndex();
  const rawPosts = getRawPosts();

  const refs = Object.keys(index);
  const unindexedPosts = rawPosts.filter((p) => {
    if (!refs.includes(p.metadata.ref)) return true;

    const currentFileHash = getFileHash(p.metadata.filepath);

    return currentFileHash !== index[p.metadata.ref].fileHash;
  });
  console.log(`${unindexedPosts.length} file(s) are unindexed or updated.`);

  const summarizedPosts = await Promise.all(
    unindexedPosts.map(async (post) => ({
      ...post,
      summary: await summarize(post),
    })),
  );
  console.log(summarizedPosts);

  const postsWithEmbedding = await embedPosts(summarizedPosts);
  for (const post of postsWithEmbedding) {
    if (post.summary === null || post.embedding === null)
      throw new Error("`summary` or `embedding` is null.");
    index[post.metadata.ref] = {
      fileHash: getFileHash(post.metadata.filepath),
      embedding: post.embedding,
      summary: post.summary,
    };
  }

  saveSummaryIndex(index);
};

vectorize();
