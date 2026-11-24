#!/usr/bin/env node
// Runs the checks that CI does not do, for one Renovate PR, and prints the results as Markdown.
// Usage: node .claude/skills/review-renovate/scripts/verify.mjs <PR number> --work <dir>
//   --work: a scratch directory for worktrees, tools and screenshots (never the repository itself)
// Set GH_BIN when gh is not on PATH.
//
// What it does, all locally and without secrets:
//   1. Builds the PR and its merge base in separate git worktrees (husky disabled).
//   2. Compares the exported sites: visible text per page, CSS, and HTML.
//   3. Serves both sites, takes screenshots of representative pages and changed pages,
//      compares them pixel by pixel, and collects console errors.
//   4. Runs smoke tests for the scripts CI does not run (vectorize, dotenvx, googleapis),
//      with a local mock instead of the OpenAI API.
// It never pushes, comments, or touches the main working tree.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The commit the PR is compared against. For a merged PR the head is already in the base branch,
// so the merge commit's first parent is used instead of the merge base.
function baseOf(baseRef, head) {
  const mb = execFileSync("git", ["merge-base", baseRef, head], { encoding: "utf8" }).trim();
  const headSha = execFileSync("git", ["rev-parse", head], { encoding: "utf8" }).trim();
  if (mb !== headSha) return mb;
  const merges = execFileSync("git", ["rev-list", "--ancestry-path", "--merges", "--reverse", `${head}..${baseRef}`], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  return merges.length ? execFileSync("git", ["rev-parse", `${merges[0]}^1`], { encoding: "utf8" }).trim() : `${headSha}^`;
}


const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GH = process.env.GH_BIN || "gh";
const args = process.argv.slice(2);
const prNumber = args.find((a) => /^\d+$/.test(a));
const workIdx = args.indexOf("--work");
const WORK = workIdx >= 0 ? path.resolve(args[workIdx + 1]) : null;
if (!prNumber || !WORK) {
  console.error("usage: verify.mjs <PR number> --work <scratch dir>");
  process.exit(2);
}
const REPO = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
if (WORK.startsWith(REPO + path.sep) || WORK === REPO) {
  console.error("--work must be outside the repository");
  process.exit(2);
}
fs.mkdirSync(WORK, { recursive: true });

const log = (...m) => console.error(`[verify #${prNumber}]`, ...m);
const sh = (cmd, argv, opts = {}) =>
  execFileSync(cmd, argv, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...opts });
function shTry(cmd, argv, opts = {}) {
  try {
    return { ok: true, out: sh(cmd, argv, opts) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ""}${e.stderr || ""}` || e.message, code: e.status };
  }
}
// Elements whose content depends on render timing, not on dependencies. They are blanked in screenshots.
// Matched by the start of their text, because PyScript rebuilds the surrounding DOM.
// PyScript/PyRepl change their caption depending on whether the terminal has rendered yet.
const BLANK_TEXT_PREFIXES = ["WebAssembly で実行されます"];
// The site uses system fonts. Without a Japanese font, headless Chromium draws Japanese as tofu.
const FONTS = ["Regular", "Bold"].map((w) => ({
  file: `NotoSansJP-${w}.otf`,
  url: `https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/JP/NotoSansJP-${w}.otf`,
}));

const report = [];
const say = (...lines) => report.push(...lines);

// ---------- worktrees ----------
const pr = JSON.parse(sh(GH, ["pr", "view", prNumber, "--json", "headRefName,baseRefName,headRefOid,title,isCrossRepository"]));
// Only branches of this repository: Renovate's, and the fix PRs this skill opens. A fork's PR carries
// code anyone can write, and this script installs and builds it (in Actions, in a job that can push),
// so it refuses one whoever asks for it.
if (pr.isCrossRepository) {
  console.error(`#${prNumber} はフォークからの PR なので確かめない（PR のコードを install して build するため）`);
  process.exit(5);
}
sh("git", ["fetch", "--quiet", "origin",
  `+refs/heads/${pr.baseRefName}:refs/remotes/origin/${pr.baseRefName}`,
  `+refs/pull/${prNumber}/head:refs/remotes/origin/pr/${prNumber}`]);
const prSha = sh("git", ["rev-parse", `origin/pr/${prNumber}`]).trim();
const baseTip = sh("git", ["rev-parse", `origin/${pr.baseRefName}`]).trim();
let baseSha = baseOf(`origin/${pr.baseRefName}`, prSha);
let headSha = prSha;
// An open PR whose branch is behind the base branch: what lands on merge is the branch merged into
// the base tip, not the branch alone. A fix already on the base (for example #28 for pnpm 12's
// allowBuilds) is missing from the branch, so the branch alone can fail where the merge would not.
// Compare the base tip with a local merge commit instead. Nothing is pushed.
let behind = null;
if (!shTry("git", ["merge-base", "--is-ancestor", prSha, baseTip]).ok && baseSha !== baseTip) {
  behind = { count: Number(sh("git", ["rev-list", "--count", `${baseSha}..${baseTip}`]).trim()), conflict: false };
  const mt = shTry("git", ["merge-tree", "--write-tree", baseTip, prSha]);
  if (mt.ok) {
    const tree = mt.out.trim().split("\n")[0];
    headSha = sh("git", ["commit-tree", tree, "-p", baseTip, "-p", prSha, "-m", `verify: #${prNumber} merged into ${pr.baseRefName}`]).trim();
    baseSha = baseTip;
  } else {
    behind.conflict = true;
  }
}

// ---------- cleanup and free space ----------
// Each worktree holds its own node_modules and build output (several GB), and every Claude Code
// session has its own scratchpad, so old runs pile up. Before building, remove:
//   - worktrees in WORK other than the ones this run uses (older PRs, older bases)
//   - worktrees in the same --work directory of other sessions' scratchpads
// Only worktrees are removed (5-6 GB each). Reports, logs, screenshots and tools are tens of MB
// and stay, so another session can still read its results.
// A worktree whose verify.mjs is still running (pid in .verify-pid) is kept.
const BASE_NAME = `base-${baseSha.slice(0, 8)}`;
const HEAD_NAME = `pr-${prNumber}`;
const WORKTREE_RE = /^(base-[0-9a-f]{8}|pr-\d+)$/;
function inUse(dir) {
  try {
    const pid = Number(fs.readFileSync(path.join(dir, ".verify-pid"), "utf8"));
    if (!pid || pid === process.pid) return false;
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
const removed = [];
const rm = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
  removed.push(dir);
};
for (const e of fs.readdirSync(WORK)) {
  const dir = path.join(WORK, e);
  if (WORKTREE_RE.test(e) && e !== BASE_NAME && e !== HEAD_NAME && !inUse(dir)) rm(dir);
}
// <root>/<session>/scratchpad/<name>: only when WORK sits directly in a scratchpad.
if (path.basename(path.dirname(WORK)) === "scratchpad") {
  const name = path.basename(WORK);
  const root = path.dirname(path.dirname(path.dirname(WORK)));
  for (const session of fs.readdirSync(root)) {
    const other = path.join(root, session, "scratchpad", name);
    if (other === WORK || !fs.existsSync(other)) continue;
    for (const e of fs.readdirSync(other)) {
      const dir = path.join(other, e);
      if (WORKTREE_RE.test(e) && !inUse(dir)) rm(dir);
    }
  }
  // Fix worktrees (<scratchpad>/renovate-fix-<N>, step 7 of the skill) of other sessions. One is
  // removed only when nothing in it would be lost and nobody is using it: no uncommitted changes,
  // HEAD is on a remote branch (pushed, or origin/main itself), no in-worktree.mjs running in it,
  // and no git activity for an hour.
  for (const session of fs.readdirSync(root)) {
    const pad = path.join(root, session, "scratchpad");
    if (pad === path.dirname(WORK) || !fs.existsSync(pad)) continue;
    for (const e of fs.readdirSync(pad)) {
      if (!/^renovate-fix-\d+$/.test(e)) continue;
      const dir = path.join(pad, e);
      const g = (...a) => shTry("git", ["-C", dir, ...a]);
      const gitDir = g("rev-parse", "--absolute-git-dir");
      if (!gitDir.ok) continue;
      const gd = gitDir.out.trim();
      const status = g("status", "--porcelain");
      const pushed = g("branch", "-r", "--contains", "HEAD");
      const last = Math.max(...["index", "HEAD", "logs/HEAD"].map((f) => {
        try {
          return fs.statSync(path.join(gd, f)).mtimeMs;
        } catch {
          return 0;
        }
      }));
      if (!status.ok || status.out.trim() || !pushed.ok || !pushed.out.trim()) continue;
      if (inUse(gd) || Date.now() - last < 60 * 60 * 1000) continue;
      if (shTry("git", ["worktree", "remove", "--force", dir]).ok) removed.push(dir);
      else rm(dir);
    }
  }
}
if (removed.length) {
  sh("git", ["worktree", "prune"]);
  log(`removed ${removed.length} old directories:\n  ${removed.join("\n  ")}`);
}
const MIN_FREE_GB = 10;
{
  const st = fs.statfsSync(WORK);
  const freeGb = (st.bavail * st.bsize) / 1024 ** 3;
  if (freeGb < MIN_FREE_GB) {
    console.error(
      `空き容量が足りないので止めます。${WORK} のあるボリュームの空きは ${freeGb.toFixed(1)} GB で、` +
        `1件の確認には ${MIN_FREE_GB} GB ほど要ります。何も build していません。`,
    );
    process.exit(3);
  }
}

function worktree(name, sha) {
  const dir = path.join(WORK, name);
  if (fs.existsSync(path.join(dir, ".git"))) {
    sh("git", ["-C", dir, "checkout", "--quiet", "--detach", sha]);
  } else {
    sh("git", ["worktree", "add", "--quiet", "--detach", dir, sha]);
  }
  fs.writeFileSync(path.join(dir, ".verify-pid"), String(process.pid));
  return dir;
}
const sites = {
  base: { dir: worktree(BASE_NAME, baseSha), sha: baseSha },
  head: { dir: worktree(HEAD_NAME, headSha), sha: headSha },
};

// ---------- install and build ----------
const pnpmVersion = (dir) =>
  (fs.readFileSync(path.join(dir, ".github/workflows/ci.yml"), "utf8").match(/version:\s*([0-9][\w.]*)/) || [])[1] || "10";
const env = { ...process.env, HUSKY: "0", CI: "1", NEXT_TELEMETRY_DISABLED: "1" };
delete env.OPENAI_API_KEY;
delete env.GOOGLE_SA_CLIENT_EMAIL;
delete env.GOOGLE_SA_PRIVATE_KEY;
// If anything still builds an OpenAI client, point it at a closed local port instead of api.openai.com.
env.OPENAI_BASE_URL = "http://127.0.0.1:9/v1";

// Each site runs on the Node major in its own .nvmrc, as CI and the deploy do. When that differs from
// the Node running this script, the npm package "node@<major>" provides the binary, and its directory
// goes first on PATH, so npx, pnpm, next, tsx and dotenvx (all "#!/usr/bin/env node") use it.
const nodeMajorOf = (dir) => {
  try {
    return Number(fs.readFileSync(path.join(dir, ".nvmrc"), "utf8").trim().replace(/^v/, "").split(".")[0]) || null;
  } catch {
    return null;
  }
};
const nodeBins = new Map();
function nodeEnv(major) {
  const current = Number(process.versions.node.split(".")[0]);
  if (!major || major === current) return { env, node: process.version };
  if (!nodeBins.has(major)) {
    const r = shTry("npx", ["-y", `node@${major}`, "-p", "process.execPath + ' ' + process.version"], { env });
    nodeBins.set(major, r.ok ? r.out.trim().split(/\s+/) : null);
  }
  const got = nodeBins.get(major);
  if (!got) return { env, node: process.version, failed: `Node ${major} を用意できなかった（npx node@${major}）` };
  return { env: { ...env, PATH: `${path.dirname(got[0])}${path.delimiter}${env.PATH}` }, node: got[1] };
}

for (const [name, s] of Object.entries(sites)) {
  s.pnpm = ["-y", `pnpm@${pnpmVersion(s.dir)}`];
  s.nodeMajor = nodeMajorOf(s.dir);
  const ne = nodeEnv(s.nodeMajor);
  s.env = ne.env;
  s.node = ne.node;
  s.nodeFailed = ne.failed;
  const stamp = path.join(s.dir, ".verify-built");
  // The stamp names the Node too: a base built on another Node is built again.
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === `${s.sha} ${s.node}`) {
    log(`${name}: reuse build of ${s.sha.slice(0, 8)}`);
    s.build = { ok: true, reused: true };
    continue;
  }
  log(`${name}: install (pnpm ${pnpmVersion(s.dir)}, node ${s.node})`);
  const inst = shTry("npx", [...s.pnpm, "install", "--frozen-lockfile"], { cwd: s.dir, env: s.env });
  fs.writeFileSync(path.join(WORK, `${name}-${prNumber}-install.log`), inst.out);
  if (!inst.ok) {
    s.build = { ok: false, step: "install" };
    continue;
  }
  log(`${name}: build`);
  const t = Date.now();
  const b = shTry("npx", [...s.pnpm, "build"], { cwd: s.dir, env: s.env });
  fs.writeFileSync(path.join(WORK, `${name}-${prNumber}-build.log`), b.out);
  s.build = { ok: b.ok, step: "build", seconds: Math.round((Date.now() - t) / 1000) };
  if (b.ok) fs.writeFileSync(stamp, `${s.sha} ${s.node}`);
}

say(`# #${prNumber} ${pr.title} の確認結果`, "");
if (behind && !behind.conflict) {
  say(
    `- PR のブランチ（${prSha.slice(0, 8)}）は ${pr.baseRefName} より ${behind.count} コミット遅れている。` +
      `マージで入る状態を見るため、${pr.baseRefName} の先頭（${baseSha.slice(0, 8)}）を base に、` +
      `それに PR を重ねた手元のマージコミット（${headSha.slice(0, 8)}、push しない）を PR として比べた`,
  );
} else if (behind) {
  say(`- PR のブランチ（${prSha.slice(0, 8)}）は ${pr.baseRefName} より ${behind.count} コミット遅れていて、重ねるとコンフリクトする。ブランチ単体と merge-base（${baseSha.slice(0, 8)}）で比べた`);
} else {
  say(`- base: ${baseSha.slice(0, 8)}（merge-base）、PR: ${headSha.slice(0, 8)}`);
}
say(`- 作業ディレクトリ: ${WORK}`);
if (removed.length) say(`- 片付けた古い作業ディレクトリ: ${removed.length}件`);
say("");
say("## build", "");
for (const [name, s] of Object.entries(sites)) say(`- ${name} の Node: ${s.node}（.nvmrc ${s.nodeMajor ?? "なし"}）${s.nodeFailed ? `。${s.nodeFailed}。この版で確かめていない` : ""}`);
for (const [name, s] of Object.entries(sites)) {
  const b = s.build;
  say(`- ${name}: ${b.ok ? "成功" : `失敗（${b.step}）`}${b.reused ? "（前回の build を再利用）" : b.seconds ? `（${b.seconds}秒）` : ""}${b.ok ? "" : `　ログ: ${path.join(WORK, `${name}-${prNumber}-${b.step}.log`)}`}`);
}
say("");

// ---------- lint ----------
// CI runs lint only on the PR. Running it on both sides tells new problems from ones that were already there.
function lint(name, s) {
  const file = path.join(WORK, `${name}-${prNumber}-eslint.json`);
  fs.rmSync(file, { force: true });
  const r = shTry("npx", [...s.pnpm, "exec", "eslint", ".", "-f", "json", "-o", file], { cwd: s.dir, env: s.env });
  let results;
  try {
    results = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    const lines = r.out.split("\n").map((l) => l.trim()).filter(Boolean);
    return { crashed: true, detail: (lines.find((l) => /error|not support|cannot|failed/i.test(l)) || lines.at(-1) || "").slice(0, 300) };
  }
  const messages = results.flatMap((f) =>
    f.messages.map((m) => ({ key: `${path.relative(s.dir, f.filePath)} ${m.ruleId || "-"} ${m.message}`, line: m.line, severity: m.severity })),
  );
  return { messages, errors: messages.filter((m) => m.severity === 2).length, warnings: messages.filter((m) => m.severity === 1).length };
}
const lintRes = {};
for (const [name, s] of Object.entries(sites)) if (s.build.ok || s.build.step === "build") lintRes[name] = lint(name, s);
say("## lint（eslint .）", "");
for (const [name, l] of Object.entries(lintRes)) {
  say(`- ${name}: ${l.crashed ? `実行できなかった（${l.detail}）` : `エラー ${l.errors}件、警告 ${l.warnings}件`}`);
}
if (lintRes.base && lintRes.head && !lintRes.base.crashed && !lintRes.head.crashed) {
  const before = new Set(lintRes.base.messages.map((m) => m.key));
  const after = new Set(lintRes.head.messages.map((m) => m.key));
  const added = lintRes.head.messages.filter((m) => !before.has(m.key));
  const gone = lintRes.base.messages.filter((m) => !after.has(m.key));
  say(`- PR で新しく出たもの: ${added.length}件${added.length ? "" : `（base にもあるもの ${lintRes.head.messages.length}件は、PR とは関係ない）`}`);
  say(...added.slice(0, 10).map((m) => `  - ${m.severity === 2 ? "エラー" : "警告"}: ${m.key}（${m.line}行目）`));
  if (gone.length) say(`- PR で出なくなったもの: ${gone.length}件`, ...gone.slice(0, 5).map((m) => `  - ${m.key}`));
} else if (lintRes.head?.crashed && !lintRes.base?.crashed) {
  say("- base では動き、PR では動かない。PR が持ち込んだ問題として扱う");
}
say("");

// ---------- compare exported sites ----------
const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p)];
  });
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // Inline tags join their text without a gap (a highlighter splitting "export FOO" into spans must not change the text).
    .replace(/<\/?(span|a|code|em|strong|b|i|mark|sub|sup|small)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&nbsp;": " " })[m] || m)
    .replace(/\s+/g, " ")
    .trim();
const normalizeHtml = (html) =>
  html
    .replace(/\/_next\/static\/[^"'\s)]+/g, "/_next/static/X")
    .replace(/"buildId":"[^"]+"/g, '"buildId":"X"')
    .replace(/<script[\s\S]*?<\/script>/gi, "<script/>");

// Code blocks: <pre> elements with the language from a "language-xxx" class.
const preBlocks = (html) =>
  [...normalizeHtml(html).matchAll(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi)].map((m) => ({
    html: m[0],
    lang: (m[0].match(/language-([\w+-]+)/) || [])[1] || "不明",
    text: visibleText(m[0]),
  }));
const withoutPre = (html) => normalizeHtml(html).replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, "<pre/>");
// Leaf tokens of a highlighted block: text -> { color, cls } of the innermost span (empty when not in a span).
// react-syntax-highlighter colors with inline styles, so the color is what the reader sees; the class may change alone.
const tokens = (html) => {
  const map = new Map();
  for (const m of html.matchAll(/<span\b([^>]*)>([^<]+)<\/span>|>([^<]+)</g)) {
    const text = (m[2] ?? m[3] ?? "").trim();
    const attrs = m[1] || "";
    if (text && !map.has(text)) map.set(text, { color: (attrs.match(/color:\s*([^;"]+)/) || [])[1] || "", cls: (attrs.match(/class="([^"]*)"/) || [])[1] || "" });
  }
  return map;
};
const tokenChanges = (b, h) => {
  const [tb, th] = [tokens(b), tokens(h)];
  const color = [];
  let clsOnly = 0;
  for (const [t, x] of th) {
    const y = tb.get(t);
    if (!y) continue;
    if (y.color !== x.color) color.push(`「${t.slice(0, 20)}」${y.color || "既定の色"} → ${x.color || "既定の色"}`);
    else if (y.cls !== x.cls) clsOnly++;
  }
  return { color, clsOnly };
};
const codeExamples = new Map();

// How a page changed inside its code blocks: null when something outside them changed too.
function codeOnly(b, h) {
  if (withoutPre(b) !== withoutPre(h)) return null;
  const [pb, ph] = [preBlocks(b), preBlocks(h)];
  if (pb.length !== ph.length) return null;
  // lang -> number of tokens whose color changed on this page
  const langs = new Map();
  let textChanged = false;
  pb.forEach((x, i) => {
    if (x.html === ph[i].html) return;
    if (x.text !== ph[i].text) textChanged = true;
    const ex = codeExamples.get(x.lang) || { color: [], colorCount: 0, clsOnly: 0 };
    const tc = tokenChanges(x.html, ph[i].html);
    langs.set(x.lang, (langs.get(x.lang) || 0) + tc.color.length);
    ex.color = [...new Set([...ex.color, ...tc.color])].slice(0, 4);
    ex.colorCount += tc.color.length;
    ex.clsOnly += tc.clsOnly;
    codeExamples.set(x.lang, ex);
  });
  return { langs, textChanged };
}

// git diff of two texts, one line per tag so minified HTML or a one-line sitemap gives a readable diff.
function textDiff2(a, b) {
  const tmp = fs.mkdtempSync(path.join(WORK, "diff-"));
  fs.writeFileSync(path.join(tmp, "base"), a.replace(/></g, ">\n<"));
  fs.writeFileSync(path.join(tmp, "head"), b.replace(/></g, ">\n<"));
  const d = shTry("git", ["-C", tmp, "diff", "--no-index", "--no-color", "-U1", "base", "head"]);
  fs.rmSync(tmp, { recursive: true, force: true });
  return d.out;
}

const changedPages = [];
const codeOnlyPages = new Set();
const codeLangs = new Map();
const bothBuilt = sites.base.build.ok && sites.head.build.ok;
if (bothBuilt) {
  const outs = Object.fromEntries(Object.entries(sites).map(([k, s]) => [k, path.join(s.dir, "out")]));
  const pages = (dir) => new Set(walk(dir).filter((f) => f.endsWith(".html")));
  const [bp, hp] = [pages(outs.base), pages(outs.head)];
  const added = [...hp].filter((p) => !bp.has(p));
  const removed = [...bp].filter((p) => !hp.has(p));
  let textDiff = 0;
  let htmlDiff = 0;
  let htmlSpaceOnly = 0;
  const samples = [];
  const htmlSamples = [];
  for (const p of [...hp].filter((p) => bp.has(p))) {
    const [b, h] = [fs.readFileSync(path.join(outs.base, p), "utf8"), fs.readFileSync(path.join(outs.head, p), "utf8")];
    const [tb, th] = [visibleText(b), visibleText(h)];
    const code = tb !== th || normalizeHtml(b) !== normalizeHtml(h) ? codeOnly(b, h) : null;
    if (code && !code.textChanged) {
      codeOnlyPages.add(p);
      for (const [l, color] of code.langs) codeLangs.set(l, [...(codeLangs.get(l) || []), { page: p, color }]);
      continue;
    }
    if (tb !== th) {
      textDiff++;
      changedPages.push(p);
      if (samples.length < 5) {
        let i = 0;
        while (i < tb.length && tb[i] === th[i]) i++;
        samples.push(`- ${p}: 「…${tb.slice(Math.max(0, i - 40), i + 80)}…」→「…${th.slice(Math.max(0, i - 40), i + 80)}…」`);
      }
    } else if (normalizeHtml(b) !== normalizeHtml(h)) {
      htmlDiff++;
      // Whitespace between tags only (e.g. blank lines before a <table> after a parse5 update): it
      // does not change the rendering of block elements, so it is counted apart.
      const squash = (s) => normalizeHtml(s).replace(/\s+/g, " ").replace(/> </g, "><");
      if (squash(b) === squash(h)) {
        htmlSpaceOnly++;
        continue;
      }
      if (changedPages.length < 50) changedPages.push(p);
      // Written to a file below: in Actions, Claude can Read a file but cannot run diff pipelines.
      if (htmlSamples.length < 5) htmlSamples.push(`# ${p}（script とアセットのハッシュは置き換えて比べた）\n${textDiff2(normalizeHtml(b), normalizeHtml(h))}`);
    }
  }
  const css = (dir) => walk(dir).filter((f) => f.endsWith(".css")).sort().map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  const [cb, ch] = [css(outs.base), css(outs.head)];
  const cssRules = (c) => new Set(c.split("}").map((r) => r.trim()).filter(Boolean));
  const [rb, rh] = [cssRules(cb), cssRules(ch)];
  const cssAdded = [...rh].filter((r) => !rb.has(r));
  const cssRemoved = [...rb].filter((r) => !rh.has(r));

  say("## 出力の比較（静的 export）", "");
  say(`- ページ数: base ${bp.size}、PR ${hp.size}（追加 ${added.length}、削除 ${removed.length}）`);
  if (added.length || removed.length) say(`  - 追加: ${added.slice(0, 10).join(", ") || "なし"}`, `  - 削除: ${removed.slice(0, 10).join(", ") || "なし"}`);
  say(`- 表示テキストが変わったページ: ${textDiff}`);
  say(...samples.map((s) => `  ${s}`));
  say(`- テキストは同じで HTML 構造だけ変わったページ: ${htmlDiff}（script とアセットのハッシュは無視）`);
  if (htmlSpaceOnly) say(`  - うち、タグの間の空白だけが違うページ: ${htmlSpaceOnly}（表示に影響しないので、撮影と差分ファイルから外した）`);
  if (htmlSamples.length) {
    const htmlFile = path.join(WORK, `pr-${prNumber}-html.diff.txt`);
    fs.writeFileSync(htmlFile, htmlSamples.join("\n"));
    say(`  - 差分（最初の ${htmlSamples.length} ページ）: ${htmlFile}`);
  }
  say(`- コードブロック（pre）の中だけが変わったページ: ${codeOnlyPages.size}（コードのテキストは同じで、色付けの span と class だけが違う。上の2つには数えていない）`);
  if (codeLangs.size) {
    say(`  - 変わったブロックの言語: ${[...codeLangs].map(([l, ps]) => `${l}（${ps.length}ページ）`).join("、")}`);
    // One page per language goes to the screenshots, so every kind of change is looked at once.
    // The page with the most color changes is picked: a class-only page would show nothing.
    for (const [l, ps] of codeLangs) {
      const ex = codeExamples.get(l) || { color: [], colorCount: 0, clsOnly: 0 };
      const pick = ps.reduce((a, b) => (b.color > a.color ? b : a));
      say(`  - ${l}: 色が変わったトークン ${ex.colorCount}件${ex.color.length ? `（例: ${ex.color.join("、")}）` : ""}、色は同じで class だけ変わったもの ${ex.clsOnly}件。撮影: ${pick.page}（${pick.color ? `色の変化 ${pick.color}件` : "class だけの変化"}）`);
      if (!changedPages.includes(pick.page)) changedPages.push(pick.page);
    }
  }
  say(`- CSS: ${cb === ch ? "完全に一致" : `差分あり（ルール 追加 ${cssAdded.length}、削除 ${cssRemoved.length}、サイズ ${cb.length} → ${ch.length} バイト）`}`);
  if (cb !== ch) {
    const cssFile = path.join(WORK, `pr-${prNumber}-css.diff.txt`);
    fs.writeFileSync(cssFile, ["# removed", ...cssRemoved.map((r) => r + "}"), "", "# added", ...cssAdded.map((r) => r + "}")].join("\n"));
    say(`  - ルールの差分: ${cssFile}`);
  }
  // Files outside the pages: sitemap*.xml and robots.txt (next-sitemap), feed.xml, ads.txt, CNAME,
  // the IndexNow key, images copied from public/. _next/ (hashed bundles) and the RSC payloads
  // (<page>.txt next to <page>.html, __next.*.txt) are build artifacts and are skipped.
  const extras = (dir) =>
    new Set(walk(dir).filter((f) => {
      if (f.startsWith("_next/") || f.endsWith(".html") || f.endsWith(".css")) return false;
      if (f.endsWith(".txt") && (path.basename(f).startsWith("__next.") || fs.existsSync(path.join(dir, f.replace(/\.txt$/, ".html"))))) return false;
      return true;
    }));
  const [eb, eh] = [extras(outs.base), extras(outs.head)];
  const eAdded = [...eh].filter((f) => !eb.has(f));
  const eRemoved = [...eb].filter((f) => !eh.has(f));
  const textExt = /\.(xml|txt|json|ya?ml|webmanifest|py)$|(^|\/)(CNAME|\.nojekyll)$/;
  // sitemap's <lastmod> is the build time, so timestamps are blanked before comparing.
  const BUILD_TIME = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)/g;
  const readExtra = (dir, f) => {
    const buf = fs.readFileSync(path.join(dir, f));
    return textExt.test(f) ? buf.toString("utf8").replace(BUILD_TIME, "<時刻>") : buf;
  };
  const sameExtra = (f) => {
    const [a, b] = [readExtra(outs.base, f), readExtra(outs.head, f)];
    return typeof a === "string" ? a === b : a.equals(b);
  };
  const eChanged = [...eh].filter((f) => eb.has(f) && !sameExtra(f));
  say(`- ページ以外のファイル（sitemap、robots.txt、feed など ${eh.size}件）: ${eAdded.length + eRemoved.length + eChanged.length ? `追加 ${eAdded.length}、削除 ${eRemoved.length}、中身が変わった ${eChanged.length}` : "すべて一致"}`);
  if (eAdded.length) say(`  - 追加: ${eAdded.slice(0, 10).join(", ")}`);
  if (eRemoved.length) say(`  - 削除: ${eRemoved.slice(0, 10).join(", ")}`);
  if (eChanged.length) {
    const diffFile = path.join(WORK, `pr-${prNumber}-extras.diff.txt`);
    const parts = [];
    for (const f of eChanged) {
      if (!textExt.test(f)) {
        parts.push(`# ${f}: バイナリが変わった`);
        continue;
      }
      parts.push(`# ${f}（時刻は <時刻> に置き換えて比べた）`, textDiff2(readExtra(outs.base, f), readExtra(outs.head, f)));
    }
    fs.writeFileSync(diffFile, parts.join("\n"));
    say(`  - 変わった: ${eChanged.slice(0, 10).join(", ")}`, `  - 差分: ${diffFile}`);
    // A sitemap whose order changed gives a long diff; the URL sets are what search engines see.
    for (const f of eChanged.filter((f) => /sitemap[^/]*\.xml$/.test(f))) {
      const locs = (dir) => new Set([...fs.readFileSync(path.join(dir, f), "utf8").matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]));
      const [lb, lh] = [locs(outs.base), locs(outs.head)];
      const la = [...lh].filter((u) => !lb.has(u));
      const lr = [...lb].filter((u) => !lh.has(u));
      say(`  - ${f} の URL: base ${lb.size}、PR ${lh.size}（増えた ${la.length}、消えた ${lr.length}${la.length + lr.length ? "" : "。並び順か属性だけの違い"}）`);
      if (la.length) say(`    - 増えた: ${la.slice(0, 10).join(", ")}`);
      if (lr.length) say(`    - 消えた: ${lr.slice(0, 10).join(", ")}`);
    }
  }
  say("");
}

// ---------- screenshots ----------
async function screenshots() {
  const tools = path.join(WORK, "tools");
  if (!fs.existsSync(path.join(tools, "node_modules/playwright-core"))) {
    log("install playwright-core, pngjs, pixelmatch into", tools);
    fs.mkdirSync(tools, { recursive: true });
    sh("npm", ["init", "-y"], { cwd: tools });
    sh("npm", ["install", "--silent", "playwright-core", "pngjs", "pixelmatch@5"], { cwd: tools });
  }
  const fontDir = path.join(tools, "fonts");
  fs.mkdirSync(fontDir, { recursive: true });
  for (const f of FONTS) {
    if (!fs.existsSync(path.join(fontDir, f.file))) {
      log("download", f.file);
      sh("curl", ["-sSfL", "-o", path.join(fontDir, f.file), f.url]);
    }
  }
  const fontsConf = path.join(tools, "fonts.conf");
  fs.writeFileSync(fontsConf, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>${fontDir}</dir>
  <cachedir>${path.join(tools, "fontcache")}</cachedir>
</fontconfig>
`);
  const { createRequire } = await import("node:module");
  const require = createRequire(path.join(tools, "package.json"));
  const { chromium } = require("playwright-core");
  const { PNG } = require("pngjs");
  const pixelmatch = require("pixelmatch");

  // Prefer a Chromium that is already downloaded; download one only when there is none.
  const cache = path.join(os.homedir(), ".cache/ms-playwright");
  let executablePath = chromium.executablePath();
  if (!fs.existsSync(executablePath)) {
    const cands = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1])) : [];
    const found = cands.map((d) => path.join(cache, d, "chrome-linux64/chrome")).find((p) => fs.existsSync(p));
    if (found) executablePath = found;
    else {
      log("download chromium");
      sh("npx", ["-y", "playwright-core", "install", "chromium"], { cwd: tools });
      executablePath = chromium.executablePath();
    }
  }

  const serve = (root) =>
    new Promise((resolve) => {
      const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain", ".woff2": "font/woff2" };
      const server = http.createServer((req, res) => {
        const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
        const tries = [u, `${u}.html`, path.join(u, "index.html")].map((p) => path.join(root, p));
        const file = tries.find((p) => p.startsWith(root) && fs.existsSync(p) && fs.statSync(p).isFile());
        if (!file) {
          res.writeHead(404);
          return res.end();
        }
        res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
      });
      server.listen(0, "127.0.0.1", () => resolve(server));
    });

  // Representative pages, plus pages whose output changed.
  const outHead = path.join(sites.head.dir, "out");
  const exists = (p) => fs.existsSync(path.join(outHead, p));
  const postsWith = (re) => {
    const r = shTry("git", ["-C", sites.head.dir, "grep", "-lE", re, "--", "posts"]);
    return r.ok ? r.out.split("\n").filter(Boolean).map((f) => f.replace(/\.md$/, ".html")).filter(exists) : [];
  };
  const latest = shTry("git", ["-C", sites.head.dir, "log", "-1", "--diff-filter=A", "--name-only", "--format=", "--", "posts"]).out?.trim().split("\n")[0]?.replace(/\.md$/, ".html");
  const firstTag = exists("tags") ? fs.readdirSync(path.join(outHead, "tags")).find((f) => f.endsWith(".html")) : null;
  const pages = [...new Set([
    "index.html", "page/2.html", "profile.html", firstTag && `tags/${firstTag}`,
    latest, postsWith("^```pyconfig")[0], postsWith("^\\|.*\\|$")[0], postsWith("<details")[0], postsWith("^```(ts|tsx|python|go|yaml)")[0],
    ...changedPages.slice(0, 10),
  ].filter((p) => p && exists(p)))];

  const shotDir = path.join(WORK, `pr-${prNumber}-shots`);
  fs.rmSync(shotDir, { recursive: true, force: true });
  fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath, env: { ...process.env, FONTCONFIG_FILE: fontsConf } });
  const servers = {};
  for (const k of ["base", "head"]) servers[k] = await serve(path.join(sites[k].dir, "out"));
  const rows = [];
  const rectsOf = new Map();
  // Base above, PR below: the first code block that differs, cut out of both screenshots.
  const cropPair = (fa, fb, [x, y, w, h], out) => {
    const [a, b] = [PNG.sync.read(fs.readFileSync(fa)), PNG.sync.read(fs.readFileSync(fb))];
    [x, y, w, h] = [Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y)), Math.ceil(w), Math.min(Math.ceil(h), 600)];
    w = Math.min(w, a.width - x);
    h = Math.min(h, a.height - y);
    const gap = 8;
    const img = new PNG({ width: w, height: h * 2 + gap });
    img.data.fill(255);
    PNG.bitblt(a, img, x, y, w, h, 0, 0);
    PNG.bitblt(b, img, x, y, w, h, 0, h + gap);
    fs.writeFileSync(out, PNG.sync.write(img));
  };
  const errorsBy = { base: new Map(), head: new Map() };
  const viewports = [{ name: "pc", width: 1280, height: 900 }, { name: "sp", width: 390, height: 844 }];
  for (const page of pages) {
    for (const vp of viewports) {
      if (vp.name === "sp" && page !== "index.html" && !changedPages.includes(page)) continue;
      const shots = {};
      const shoot = async (k, suffix = "") => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
        const p = await ctx.newPage();
        const errs = [];
        p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
        p.on("pageerror", (e) => errs.push(`pageerror: ${e.message.slice(0, 200)}`));
        // External requests (ads, analytics, widgets) are blocked so that only this site is compared.
        await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
        const url = `http://127.0.0.1:${servers[k].address().port}/${page.replace(/\.html$/, "").replace(/^index$/, "")}`;
        await p.goto(url, { waitUntil: "networkidle" }).catch((e) => errs.push(`goto: ${e.message}`));
        await p.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" }).catch(() => {});
        await p.waitForTimeout(300);
        const file = path.join(shotDir, `${page.replace(/[\/]/g, "_")}.${vp.name}.${k}${suffix}.png`);
        // A mask follows the element's box, which changes with the text, so the elements are blanked with CSS instead.
        await p.evaluate((prefixes) => {
          for (const el of document.querySelectorAll("small, p, div, span")) {
            if (el.children.length > 3) continue;
            const text = (el.textContent || "").trim();
            if (prefixes.some((pre) => text.startsWith(pre))) {
              el.textContent = "";
              Object.assign(el.style, { display: "block", height: "1.5em" });
            }
          }
        }, BLANK_TEXT_PREFIXES).catch(() => {});
        await p.screenshot({ path: file, fullPage: true });
        // Where the code blocks are, to tell a highlighting change from a layout change.
        rectsOf.set(file, await p.evaluate(() => [...document.querySelectorAll("pre")].map((e) => {
          const r = e.getBoundingClientRect();
          return [r.left + scrollX, r.top + scrollY, r.width, r.height];
        })).catch(() => []));
        // Errors caused by the blocked external requests above.
        const ignorable = (e) => /ERR_FAILED|net::|Failed to load resource|Failed to fetch/.test(e);
        if (!suffix) errorsBy[k].set(`${page} ${vp.name}`, errs.filter((e) => !ignorable(e)));
        await ctx.close();
        return file;
      };
      for (const k of ["base", "head"]) shots[k] = await shoot(k);
      const compare = (fa, fb, diffOut) => {
        const [a, b] = [PNG.sync.read(fs.readFileSync(fa)), PNG.sync.read(fs.readFileSync(fb))];
        if (a.width !== b.width || a.height !== b.height) return { n: -1, text: `サイズが違う（${a.width}x${a.height} → ${b.width}x${b.height}）` };
        const diff = new PNG({ width: a.width, height: a.height });
        const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1, diffColor: [255, 0, 0] });
        if (n && diffOut) fs.writeFileSync(diffOut, PNG.sync.write(diff));
        // Blocks of 16x16 px that contain a differing pixel.
        const blocks = new Set();
        for (let i = 0; i < diff.data.length; i += 4) {
          if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
            const px = (i / 4) % a.width;
            const py = Math.floor(i / 4 / a.width);
            blocks.add(`${px >> 4},${py >> 4}`);
          }
        }
        return { n, blocks, text: n === 0 ? "一致" : `${((n / (a.width * a.height)) * 100).toFixed(3)}% のピクセルが違う` };
      };
      const diffFile = shots.head.replace(/\.head\.png$/, ".diff.png");
      const res = compare(shots.base, shots.head, diffFile);
      let ratio = res.text;
      let onlyUnstable = false;
      if (res.n !== 0) {
        // Shoot the base again: if the same build differs from itself, the page is unstable.
        // Differences inside the unstable area (with one block of margin) are not counted as changes.
        const again = await shoot("base", ".again");
        const self = compare(shots.base, again, null);
        fs.rmSync(again, { force: true });
        if (self.n > 0 && res.n > 0) {
          const near = (key) => {
            const [x, y] = key.split(",").map(Number);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (self.blocks.has(`${x + dx},${y + dy}`)) return true;
            return false;
          };
          const outside = [...res.blocks].filter((k) => !near(k));
          onlyUnstable = outside.length === 0;
          ratio += onlyUnstable
            ? `（揺れる部分の中だけの差。同じ base を撮り直しても ${self.text}。変化なしとみなす）`
            : `（不安定なページだが、揺れる部分の外にも差がある: 16px 四方で ${outside.length} ブロック。画像を見て確かめる）`;
        } else if (self.n !== 0) {
          ratio += `（不安定: 同じ base を撮り直しても ${self.text}。画像を見て確かめる）`;
        }
      }
      let crop = null;
      if (res.n > 0 && !onlyUnstable && res.blocks) {
        const rects = rectsOf.get(shots.head) || [];
        const inRect = (key) => {
          const [bx, by] = key.split(",").map((v) => Number(v) * 16);
          return rects.findIndex(([x, y, w, h]) => bx + 16 > x - 16 && bx < x + w + 16 && by + 16 > y - 16 && by < y + h + 16);
        };
        const hits = [...res.blocks].map(inRect);
        if (rects.length && hits.every((i) => i >= 0)) {
          const counts = new Map();
          for (const i of hits) counts.set(i, (counts.get(i) || 0) + 1);
          const most = [...counts].sort((x, y) => y[1] - x[1])[0][0];
          crop = shots.head.replace(/\.head\.png$/, ".code.png");
          // Around the differing rows only, so a long block does not push them out of the picture.
          const ys = [...res.blocks].filter((_, i) => hits[i] === most).map((k) => Number(k.split(",")[1]) * 16);
          const [rx, ry, rw, rh] = rects[most];
          const top = Math.max(ry, Math.min(...ys) - 48);
          const bottom = Math.min(ry + rh, Math.max(...ys) + 64);
          cropPair(shots.base, shots.head, [rx, top, rw, bottom - top], crop);
          ratio += `（コードブロックの中だけの差: ${counts.size}ブロック。差がいちばん多いブロックの切り抜き（上が base、下が PR）を見て、何が変わったかを確かめる）`;
        }
      }
      rows.push({ page, vp: vp.name, ratio, shots, diffFile: res.n > 0 ? diffFile : null, onlyUnstable, crop });
    }
  }
  await browser.close();
  Object.values(servers).forEach((s) => s.close());

  say("## 画面の比較（スクリーンショット）", "");
  say(`外部へのリクエスト（広告、アナリティクス、外部ウィジェット）は止めて撮影している。日本語は Noto Sans JP で描画している。描画のタイミングで変わる文言（${BLANK_TEXT_PREFIXES.map((s) => `「${s}…」`).join("、")}）は空欄にして撮っている。`, "");
  for (const r of rows) {
    say(`- ${r.page}（${r.vp}）: ${r.ratio}`);
    if (r.crop) say(`  - 切り抜き: ${r.crop}`);
    else if (r.ratio !== "一致" && !r.onlyUnstable) say(`  - base: ${r.shots.base}`, `  - PR: ${r.shots.head}`, ...(r.diffFile ? [`  - 差分: ${r.diffFile}`] : []));
  }
  const newErrors = [];
  for (const [key, errs] of errorsBy.head) {
    const before = new Set(errorsBy.base.get(key) || []);
    for (const e of errs) if (!before.has(e)) newErrors.push(`${key}: ${e}`);
  }
  const allHead = [...errorsBy.head.values()].flat().length;
  say("", `- コンソールのエラー: PR ${allHead}件、そのうち base にないもの ${newErrors.length}件`);
  say(...[...new Set(newErrors)].slice(0, 10).map((e) => `  - ${e}`));
  if (allHead) {
    const errFile = path.join(shotDir, "console-errors.txt");
    fs.writeFileSync(errFile, [...errorsBy.head].flatMap(([k, errs]) => errs.map((e) => `${k}: ${e}`)).join("\n"));
    say(`  - PR 側のエラー一覧: ${errFile}`);
  }
  say("");
}

if (bothBuilt) {
  try {
    await screenshots();
  } catch (e) {
    say("## 画面の比較（スクリーンショット）", "", `- 実行できなかった: ${e.message.split("\n")[0]}`, "");
  }
}

// ---------- smoke tests ----------
async function withMockOpenAI(fn) {
  const hits = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      hits.push(`${req.method} ${req.url}`);
      const now = Math.floor(Date.now() / 1000);
      res.setHeader("Content-Type", "application/json");
      if (req.url.endsWith("/chat/completions")) {
        return res.end(JSON.stringify({
          id: "chatcmpl-mock", object: "chat.completion", created: now, model: "gpt-4.1",
          choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "MOCK_SUMMARY" } }],
          usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
        }));
      }
      if (req.url.endsWith("/responses")) {
        return res.end(JSON.stringify({
          id: "resp-mock", object: "response", created_at: now, model: "gpt-4.1", status: "completed",
          output: [{ type: "message", id: "msg-mock", role: "assistant", status: "completed", content: [{ type: "output_text", text: "MOCK_SUMMARY", annotations: [] }] }],
          usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13 },
        }));
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}/v1`, hits);
  } finally {
    server.close();
  }
}

const runAsync = (cmd, argv, opts) =>
  new Promise((resolve) => {
    const p = spawn(cmd, argv, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => p.kill("SIGKILL"), opts.timeout || 180000);
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, out });
    });
  });

async function smoke(name) {
  const s = sites[name];
  const results = [];
  if (!fs.existsSync(path.join(s.dir, "node_modules"))) return [{ name: "全体", ok: false, detail: "node_modules がない（install 失敗）" }];
  const file = path.join(s.dir, ".verify-smoke.mts");
  fs.copyFileSync(path.join(SKILL_DIR, "scripts/smoke.mts"), file);
  await withMockOpenAI(async (baseURL, hits) => {
    const r = await runAsync("npx", [...s.pnpm, "exec", "tsx", file], { cwd: s.dir, env: { ...s.env, MOCK_OPENAI_BASE_URL: baseURL } });
    for (const line of r.out.split("\n")) {
      const m = line.match(/^SMOKE (OK|NG) ([^:]+): ?(.*)$/);
      if (m) results.push({ name: m[2], ok: m[1] === "OK", detail: m[3] });
    }
    if (!r.ok && !results.some((x) => !x.ok)) results.push({ name: "smoke.mts", ok: false, detail: r.out.trim().split("\n").slice(-3).join(" / ") });
    results.push({ name: "OpenAI モックへのリクエスト", ok: hits.length > 0, detail: hits.join(", ") || "なし" });
  });
  fs.rmSync(file, { force: true });

  // vectorize.ts itself, without an API key. With an up-to-date index it makes no API calls.
  const v = await runAsync("npx", [...s.pnpm, "exec", "tsx", "vectorize.ts"], { cwd: s.dir, env: s.env });
  const unindexed = (v.out.match(/(\d+) file\(s\) are unindexed/) || [])[1];
  const changed = shTry("git", ["-C", s.dir, "status", "--porcelain", "data/index.json"]).out.trim();
  shTry("git", ["-C", s.dir, "checkout", "--", "data/index.json"]);
  results.push({
    name: "vectorize.ts（API キーなし）",
    ok: v.ok && unindexed === "0" && !changed,
    detail: unindexed === undefined ? `起動できなかった: ${v.out.trim().split("\n").slice(-2).join(" / ")}`
      : unindexed !== "0" ? `未処理の記事が ${unindexed} 件あり、API を呼ぶ経路に入ったので判定できない`
      : changed ? "data/index.json が書き換わった" : "依存の読み込みからインデックスの保存まで通った（未処理 0 件）",
  });
  return results;
}

say("## スモークテスト（CI が動かさないスクリプト）", "");
say("OpenAI の API は呼ばない（ローカルのモックに向ける）。シークレットは環境から外して実行している。", "");
const smokeRes = {};
for (const k of ["base", "head"]) smokeRes[k] = await smoke(k);
// dotenvx across versions: a file encrypted by the base version must still decrypt with the PR version.
// .husky/pre-commit runs `dotenvx run -f .env.local`, and .env.local may be encrypted.
{
  const bin = (k) => path.join(sites[k].dir, "node_modules/.bin/dotenvx");
  let r;
  if (fs.existsSync(bin("base")) && fs.existsSync(bin("head"))) {
    const dir = fs.mkdtempSync(path.join(WORK, "dotenvx-cross-"));
    const envFile = path.join(dir, ".env.cross");
    const keysFile = path.join(dir, ".env.keys");
    fs.writeFileSync(envFile, "CROSS_VALUE=decrypted-ok\n");
    const enc = shTry(bin("base"), ["encrypt", "-f", envFile, "-fk", keysFile], { cwd: dir, env: sites.base.env });
    const encrypted = enc.ok && /encrypted:/.test(fs.readFileSync(envFile, "utf8"));
    const run = encrypted
      ? shTry(bin("head"), ["run", "-f", envFile, "-fk", keysFile, "--", "node", "-e", "process.stdout.write(process.env.CROSS_VALUE||'')"], { cwd: dir, env: sites.head.env })
      : null;
    fs.rmSync(dir, { recursive: true, force: true });
    r = !encrypted
      ? { ok: false, detail: `base の dotenvx で暗号化できなかった: ${enc.out.trim().split("\n").slice(-1)[0]}` }
      : run.ok && run.out.includes("decrypted-ok")
        ? { ok: true, detail: "base の版で暗号化した env を、PR の版で復号して渡せた" }
        : { ok: false, detail: `PR の版で復号できなかった: ${run.out.trim().split("\n").slice(-2).join(" / ")}` };
  } else {
    r = { ok: false, detail: "dotenvx がない" };
  }
  smokeRes.head.push({ name: "dotenvx 暗号化 env の互換（base で暗号化 → PR で復号）", ...r });
}

say("| テスト | base | PR | PR の詳細 |", "|---|---|---|---|");
for (const r of smokeRes.head) {
  const b = smokeRes.base.find((x) => x.name === r.name);
  say(`| ${r.name} | ${b ? (b.ok ? "OK" : "NG") : "-"} | ${r.ok ? "OK" : "NG"} | ${r.detail.replace(/\|/g, "\\|")} |`);
}
say("");

console.log(report.join("\n"));
