import crypto from "crypto";
import fs from "fs";
import { ChatOpenAI } from "@langchain/openai";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { convertSerializablePostSummaryToPostSummary } from "./utils/posts";
import { getPostData, listPostSummaries } from "./utils/readPosts";
import { PostSummary } from "./types/post";
import { loadSummaryIndex, saveSummaryIndex } from "./utils/vectorIndex";

interface PostSummaryForEmbedding extends PostSummary {
  summary: string;
}

interface PostSummaryWithEmbedding extends PostSummary {
  summary: string;
  embedding: number[];
}

const embedPosts = async (
  posts: PostSummaryForEmbedding[]
): Promise<PostSummaryWithEmbedding[]> => {
  // needs HUGGINGFACEHUB_API_KEY to be set
  const model = new HuggingFaceInferenceEmbeddings({
    model: "intfloat/multilingual-e5-large",
  });

  const docs = posts.map((post) => post.summary);
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

const summarize = async (post: PostSummary) => {
  const postData = getPostData(post.ref);
  const llm = new ChatOpenAI({
    model: "gpt-4.1",
    maxTokens: 512,
  });
  const res = await llm.invoke(
    `この記事を日本語で512 tokens以内で要約してください。\n\n---\n\n# ${postData.title}\n\n${postData.content}`
  );
  console.log(res.usage_metadata?.output_tokens);
  return res.text;
};

const vectorize = async () => {
  const index = loadSummaryIndex();
  const posts = listPostSummaries().map((post) =>
    convertSerializablePostSummaryToPostSummary(post)
  );

  const refs = Object.keys(index);
  const unindexedPosts = posts.filter((post) => {
    if (!refs.includes(post.ref)) return true;

    const currentFileHash = getFileHash(post.filepath);

    return currentFileHash !== index[post.ref].fileHash;
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
    index[post.ref] = {
      fileHash: getFileHash(post.filepath),
      embedding: post.embedding,
      summary: post.summary,
    };
  }

  saveSummaryIndex(index);
};

vectorize();
