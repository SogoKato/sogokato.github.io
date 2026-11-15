// Smoke tests for the code paths CI does not run. verify.mjs copies this file into a worktree
// and runs it there with tsx, so the imports resolve to that worktree's node_modules.
// Nothing here reaches the network: OpenAI calls go to a local mock (MOCK_OPENAI_BASE_URL).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Without the mock, ChatOpenAI would fall back to api.openai.com. Refuse to run at all.
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.MOCK_OPENAI_BASE_URL || "")) {
  console.error("MOCK_OPENAI_BASE_URL must point to the local mock (run this through verify.mjs)");
  process.exit(2);
}

const result = (name: string, ok: boolean, detail: string) =>
  console.log(`SMOKE ${ok ? "OK" : "NG"} ${name}: ${detail.replace(/\s+/g, " ").slice(0, 300)}`);

async function test(name: string, fn: () => Promise<string> | string) {
  try {
    result(name, true, await fn());
  } catch (e) {
    result(name, false, e instanceof Error ? e.message : String(e));
  }
}

const version = (pkg: string) => {
  try {
    return JSON.parse(fs.readFileSync(path.join("node_modules", pkg, "package.json"), "utf8")).version;
  } catch {
    return "?";
  }
};

// vectorize.ts: ChatOpenAI with the same options, against the mock.
await test("ChatOpenAI.invoke（モック）", async () => {
  const { ChatOpenAI } = await import("@langchain/openai");
  const llm = new ChatOpenAI({
    model: "gpt-4.1",
    maxTokens: 512,
    apiKey: "sk-mock",
    configuration: { baseURL: process.env.MOCK_OPENAI_BASE_URL },
    maxRetries: 0,
  });
  const res = await llm.invoke("smoke test");
  if (res.text !== "MOCK_SUMMARY") throw new Error(`unexpected text: ${JSON.stringify(res.text)}`);
  return `Node ${process.version}、@langchain/openai ${version("@langchain/openai")}、応答の text と usage_metadata（${res.usage_metadata?.output_tokens}）を取得`;
});

// vectorize.ts: the embedding pipeline. Loading the model would download about 2 GB, so only the API surface is checked.
await test("@huggingface/transformers の読み込み", async () => {
  const t = await import("@huggingface/transformers");
  if (typeof t.pipeline !== "function") throw new Error("pipeline is not a function");
  return `${version("@huggingface/transformers")}、pipeline を export（モデルは読み込まない）`;
});

// .husky/pre-commit: dotenvx run -f <file> -- <command>
await test("dotenvx run -f", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-dotenvx-"));
  const envFile = path.join(dir, ".env.smoke");
  fs.writeFileSync(envFile, "SMOKE_VALUE=from-dotenvx\n");
  const out = execFileSync(
    path.join("node_modules", ".bin", "dotenvx"),
    ["run", "-f", envFile, "--", process.execPath, "-e", "process.stdout.write(process.env.SMOKE_VALUE || '')"],
    { encoding: "utf8", env: { ...process.env, DOTENVX_NO_OPS: "true" } },
  );
  fs.rmSync(dir, { recursive: true, force: true });
  if (!out.includes("from-dotenvx")) throw new Error(`variable not passed: ${out}`);
  return `${version("@dotenvx/dotenvx")}、.env の値をコマンドに渡せた`;
});

// request-indexing.ts: google.auth.JWT + authorize(callback), as the script calls it.
// A throwaway RSA key signs the assertion; the token request goes to an in-process fake fetch
// (handed in through transporterOptions), which checks the signature and returns a mock token.
await test("googleapis の JWT 認証（モック）", async () => {
  const crypto = await import("node:crypto");
  const { google } = await import("googleapis");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const seen: string[] = [];
  const fakeFetch = async (input: unknown, init?: { body?: unknown }) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push(url);
    if (!/oauth2\.googleapis\.com\/token/.test(url)) throw new Error(`unexpected request: ${url}`);
    const body = new URLSearchParams(String(init?.body ?? ""));
    const assertion = body.get("assertion") || "";
    const [h, p, s] = assertion.split(".");
    const valid = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s || "", "base64url"));
    const claims = JSON.parse(Buffer.from(p || "", "base64url").toString() || "{}");
    if (!valid) throw new Error("assertion signature is invalid");
    if (claims.scope !== "https://www.googleapis.com/auth/indexing") throw new Error(`scope: ${claims.scope}`);
    return new Response(JSON.stringify({ access_token: "MOCK_TOKEN", expires_in: 3600, token_type: "Bearer" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const jwt = new google.auth.JWT({
    email: "smoke@example.com",
    key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    scopes: ["https://www.googleapis.com/auth/indexing"],
    transporterOptions: { fetchImplementation: fakeFetch as typeof fetch },
  });
  const tokens = await new Promise<{ access_token?: string | null }>((resolve, reject) =>
    jwt.authorize((err, t) => (err ? reject(err) : t ? resolve(t) : reject(new Error("Empty token(s).")))),
  );
  if (tokens.access_token !== "MOCK_TOKEN") throw new Error(`access_token: ${tokens.access_token}`);
  const { createRequire } = await import("node:module");
  let gal = "?";
  try {
    const req = createRequire(fs.realpathSync(path.join("node_modules", "googleapis", "package.json")));
    gal = JSON.parse(fs.readFileSync(req.resolve("google-auth-library/package.json"), "utf8")).version;
  } catch {}
  return `${version("googleapis")}（google-auth-library ${gal}）、署名した assertion で authorize(callback) からトークンを取得`;
});
