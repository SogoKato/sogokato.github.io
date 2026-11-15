#!/usr/bin/env node
// Posts the review of one PR as a comment on that PR, or updates the one posted before.
// Usage: node .claude/skills/review-renovate/scripts/comment.mjs <PR number> <body.md> --sha <verified head SHA> [--dry-run]
//
// - One comment per PR: the comment carrying MARKER is edited in place, so re-checks after a rebase
//   do not pile up comments.
// - --sha is the PR head that verify.mjs checked (the branch, not the local merge commit). If the PR
//   has moved on since, the result is stale and nothing is posted (exit 4).
// - Bare @names outside code are put in backticks: "@types/node" in plain text would notify the
//   GitHub user "types".
// - gh does the request, so the same script works locally (your gh login; the comment shows your
//   account) and in Actions (GH_TOKEN; the comment shows the bot).

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const MARKER = "<!-- review-renovate -->";
const LIMIT = 65000; // GitHub rejects comment bodies over 65536 characters.
const GH = process.env.GH_BIN || "gh";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const shaIdx = args.indexOf("--sha");
const sha = shaIdx >= 0 ? args[shaIdx + 1] : null;
const [prNumber, file] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--sha");
if (!/^\d+$/.test(prNumber || "") || !file || !/^[0-9a-f]{7,40}$/.test(sha || "")) {
  console.error("使い方: comment.mjs <PR番号> <本文のファイル> --sha <確かめた PR の head の SHA> [--dry-run]");
  process.exit(2);
}
const gh = (argv, input) =>
  execFileSync(GH, argv, { encoding: "utf8", input, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });

const repo = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
const pr = JSON.parse(gh(["pr", "view", prNumber, "--json", "headRefOid,state"]));
if (!pr.headRefOid.startsWith(sha) && !dry) {
  console.error(`書き込みません: 確かめたのは ${sha.slice(0, 8)} だが、PR の head は今 ${pr.headRefOid.slice(0, 8)}。verify.mjs をもう一度実行する`);
  process.exit(4);
}

// Backticks around @names outside fenced blocks and inline code.
function quoteMentions(md) {
  let fenced = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      return line
        .split(/(`[^`]*`)/)
        .map((part) => (part.startsWith("`") ? part : part.replace(/(^|[^\w`/.-])(@[A-Za-z0-9][\w.-]*(?:\/[\w.-]+)?)/g, "$1`$2`")))
        .join("");
    })
    .join("\n");
}

let content = quoteMentions(fs.readFileSync(file, "utf8").trim());
const header = [
  MARKER,
  `Claude Code（review-renovate）による自動確認です。確かめたコミット: ${sha.slice(0, 8)}（${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC）`,
  "",
  "",
].join("\n");
if (header.length + content.length > LIMIT) {
  content = content.slice(0, LIMIT - header.length - 100) + "\n\n（長すぎるので、ここで切った）";
}
const body = header + content + "\n";

// The comment to update: ours, with the marker. Our login is unknown with an Actions token, so fall back to the marker alone.
let me = null;
try {
  me = gh(["api", "user", "-q", ".login"]).trim();
} catch {}
const comments = JSON.parse(gh(["api", "--paginate", "--slurp", `repos/${repo}/issues/${prNumber}/comments?per_page=100`])).flat();
const mine = comments.filter((c) => c.body?.includes(MARKER) && (!me || c.user?.login === me));
const target = mine.at(-1);

if (dry) {
  console.log(`[dry-run] ${target ? `コメント ${target.id} を書き換える` : "新しくコメントする"}（#${prNumber}、${body.length} 文字）`);
  if (!pr.headRefOid.startsWith(sha)) console.log(`[dry-run] 注意: PR の head は今 ${pr.headRefOid.slice(0, 8)} なので、本番では書き込まない`);
  console.log(body);
  process.exit(0);
}
const out = target
  ? gh(["api", "-X", "PATCH", `repos/${repo}/issues/comments/${target.id}`, "--input", "-", "-q", ".html_url"], JSON.stringify({ body }))
  : gh(["api", "-X", "POST", `repos/${repo}/issues/${prNumber}/comments`, "--input", "-", "-q", ".html_url"], JSON.stringify({ body }));
console.log(`${target ? "書き換えた" : "コメントした"}: ${out.trim()}`);
