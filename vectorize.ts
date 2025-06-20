import crypto from "crypto";
import fs from "fs";
import { ChatOpenAI } from "@langchain/openai";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { loadSummaryIndex, saveSummaryIndex } from "./utils/vectorIndex";
import { RawPost } from "./types/post";
import { getRawPosts } from "./utils/readPosts";

const embedPosts = async (posts: RawPost[]): Promise<RawPost[]> => {
  // needs HUGGINGFACEHUB_API_KEY to be set
  const model = new HuggingFaceInferenceEmbeddings({
    model: "intfloat/multilingual-e5-large",
  });

  const docs = posts.map((p) => p.summary).filter((p) => p !== null);
  const embeddings = await model.embedDocuments(docs);

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
    `この記事を日本語で512 tokens以内で要約してください。\n\n---\n\n# ${post.metadata.title}\n\n${post.content}`
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
    }))
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
