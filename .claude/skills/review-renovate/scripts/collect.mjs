#!/usr/bin/env node
// Collects the facts needed to review open Renovate PRs and prints them as Markdown.
// Usage: node .claude/skills/review-renovate/scripts/collect.mjs [PR number ...]
// Set GH_BIN when gh is not on PATH.
// Read-only: it fetches from origin and calls the GitHub API, but never writes to PRs or branches.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// The commit the PR is compared against. For a merged PR the head is already in the base branch,
// so the merge commit's first parent is used instead of the merge base.
function baseOf(baseRef, head) {
  const mb = execFileSync("git", ["merge-base", baseRef, head], { encoding: "utf8" }).trim();
  const headSha = execFileSync("git", ["rev-parse", head], { encoding: "utf8" }).trim();
  if (mb !== headSha) return mb;
  const merges = execFileSync("git", ["rev-list", "--ancestry-path", "--merges", "--reverse", `${head}..${baseRef}`], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  return merges.length ? execFileSync("git", ["rev-parse", `${merges[0]}^1`], { encoding: "utf8" }).trim() : `${headSha}^`;
}


const GH = process.env.GH_BIN || "gh";
const MAX_LIST = 40;

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...opts });
const tryRun = (cmd, args) => {
  try {
    return run(cmd, args);
  } catch {
    return null;
  }
};
const gh = (...args) => run(GH, args);
const git = (...args) => run("git", args);

// ---------- options ----------
// --notes <dir>: save GitHub release notes of the updated packages there (PR bodies are often truncated).
const argv = process.argv.slice(2);
const notesIdx = argv.indexOf("--notes");
const NOTES_DIR = notesIdx >= 0 ? argv.splice(notesIdx, 2)[1] : null;
if (NOTES_DIR) fs.mkdirSync(NOTES_DIR, { recursive: true });

const cmpVer = (a, b) => {
  const [x, y] = [semverOf(a), semverOf(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
const semverOf = (v) => ((v || "").match(/(\d+)\.(\d+)\.(\d+)/) || [0, 0, 0, 0]).slice(1, 4).map(Number);

// Releases of pkg in (from, to], from the GitHub repository listed on npm.
function releaseNotes(pkg, from, to) {
  if (pkg === "node") return nodeNotes(Number(from.split(".")[0]), Number(to.split(".")[0]));
  const raw = tryRun("npm", ["view", pkg, "repository", "--json"]);
  let url = "";
  try {
    const info = JSON.parse(raw || "null");
    url = typeof info === "string" ? info : info?.url || "";
  } catch {}
  if (pkg === "pnpm") url = "github.com/pnpm/pnpm";
  // Repository names can contain dots (vercel/next.js); only a trailing ".git" is dropped.
  const m = url.match(/github\.com[/:]([^/]+)\/([^/#\s]+?)(?:\.git)?(?:[/#\s]|$)/);
  if (!m) return { error: "GitHub のリポジトリがわからない" };
  const repo = `${m[1]}/${m[2]}`;
  // Tags come as "v1.2.3", "1.2.3", "<pkg>@1.2.3" (monorepos) or "<name>-v1.2.3" (googleapis).
  const base = pkg.replace(/^@[^/]+\//, "");
  const own = (tag) => (tag.startsWith(`${pkg}@`) ? tag.slice(pkg.length + 1) : tag.startsWith(`${base}-v`) ? tag.slice(base.length + 2) : null);
  const plain = (tag) => (/^v?\d+\.\d+\.\d+$/.test(tag) ? tag.replace(/^v/, "") : null);
  const releases = [];
  for (let page = 1; page <= 5; page++) {
    const r = tryRun(GH, ["api", `repos/${repo}/releases?per_page=100&page=${page}`]);
    if (!r) break;
    const list = JSON.parse(r);
    releases.push(...list);
    if (list.length < 100) break;
    if (list.some((x) => { const v = own(x.tag_name) ?? plain(x.tag_name); return v && cmpVer(v, from) <= 0; })) break;
  }
  const monorepo = releases.some((x) => own(x.tag_name));
  // Plain "v1.2.3" tags belong to the root package. A sub-package without its own tags would get the parent's history.
  if (!monorepo && pkg !== "pnpm" && rootName(repo) && rootName(repo) !== pkg) {
    return { error: `${repo} のリリースは ${rootName(repo)} のもので、${pkg} の版と区別できない` };
  }
  const verOf = (tag) => (monorepo ? own(tag) : plain(tag) ?? own(tag));
  const inRange = (v) => v && /^\d+\.\d+\.\d+$/.test(v) && cmpVer(v, from) > 0 && cmpVer(v, to) <= 0;
  const picked = releases.map((x) => ({ ...x, ver: verOf(x.tag_name) })).filter((x) => inRange(x.ver));
  // Busy monorepos push older releases past the pages read above; look the missing versions up by tag.
  let published = [];
  try {
    published = JSON.parse(tryRun("npm", ["view", pkg, "versions", "--json"]) || "[]");
  } catch {}
  const missing = [].concat(published).filter((v) => inRange(v) && !picked.some((x) => x.ver === v));
  for (const v of missing.slice(0, 40)) {
    for (const tag of monorepo ? [`${pkg}@${v}`, `${base}-v${v}`] : [`v${v}`, v, `${pkg}@${v}`, `${base}-v${v}`]) {
      const r = tryRun(GH, ["api", `repos/${repo}/releases/tags/${encodeURIComponent(tag)}`]);
      if (r) {
        picked.push({ ...JSON.parse(r), ver: v });
        break;
      }
    }
  }
  picked.sort((a, b) => cmpVer(a.ver, b.ver));
  return { repo, picked, missing: missing.filter((v) => !picked.some((x) => x.ver === v)), skipped: Math.max(0, missing.length - 40) };
}

// Node: the vN.0.0 release of every major in (from, to]. Each one opens with Notable Changes
// (including "Deprecations and Removals") and lists the Semver-Major Commits; the minor and
// patch commit lists after that are dropped.
function nodeNotes(from, to) {
  const repo = "nodejs/node";
  const picked = [];
  const missing = [];
  for (let m = from + 1; m <= to; m++) {
    const r = tryRun(GH, ["api", `repos/${repo}/releases/tags/v${m}.0.0`]);
    if (!r) {
      missing.push(`${m}.0.0`);
      continue;
    }
    const x = JSON.parse(r);
    picked.push({ ...x, ver: `${m}.0.0`, body: (x.body || "").split(/^### Semver-Minor Commits/m)[0] });
  }
  return { repo, picked, missing, skipped: 0 };
}

const rootNames = new Map();
function rootName(repo) {
  if (!rootNames.has(repo)) {
    let name = null;
    try {
      // A private root (e.g. "@typescript/repo") is only a workspace; its plain tags belong to the published package.
      const root = JSON.parse(tryRun(GH, ["api", `repos/${repo}/contents/package.json`, "-H", "Accept: application/vnd.github.raw"]) || "{}");
      name = root.private ? null : root.name || null;
    } catch {}
    rootNames.set(repo, name);
  }
  return rootNames.get(repo);
}

// Sections of CHANGELOG.md for versions in (from, to]. Used when the releases only link to it.
function changelogNotes(repo, pkg, from, to) {
  // Only when the repository root is this package; a sub-package (e.g. @dotenvx/primitives) would get the parent's history.
  if (rootName(repo) !== pkg) return null;
  for (const name of ["CHANGELOG.md", "changelog.md", "CHANGES.md"]) {
    const text = tryRun(GH, ["api", `repos/${repo}/contents/${name}`, "-H", "Accept: application/vnd.github.raw"]);
    if (!text) continue;
    const sections = [];
    let cur = null;
    for (const line of text.replace(/\r/g, "").split("\n")) {
      const h = line.match(/^#{1,3}\s*\[?v?(\d+\.\d+\.\d+[\w.-]*)\]?/);
      if (h) {
        cur = { tag_name: `v${h[1]}`, ver: h[1], published_at: (line.match(/\d{4}-\d{2}-\d{2}/) || [""])[0], lines: [] };
        sections.push(cur);
      } else if (/^#{1,2}\s/.test(line)) cur = null;
      else if (cur) cur.lines.push(line);
    }
    const picked = sections
      .filter((x) => !/-/.test(x.ver) && cmpVer(x.ver, from) > 0 && cmpVer(x.ver, to) <= 0)
      .map((x) => ({ ...x, body: x.lines.join("\n") }))
      .sort((a, b) => cmpVer(a.ver, b.ver));
    if (picked.length) return { repo: `${repo} の ${name}`, picked };
  }
  return null;
}

// Drops sponsor sections, HTML and images from release notes.
function cleanNotes(body) {
  const out = [];
  let skipLevel = 0;
  for (const line of body.replace(/\r/g, "").split("\n")) {
    const h = line.match(/^(#+)\s+(.*)/);
    if (h) {
      if (skipLevel && h[1].length <= skipLevel) skipLevel = 0;
      if (/sponsor/i.test(h[2])) {
        skipLevel = h[1].length;
        continue;
      }
    }
    if (skipLevel) continue;
    if (/^\s*</.test(line) || /^\s*!\[/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------- PR list ----------
const fields = "number,title,headRefName,baseRefName,labels,url,statusCheckRollup,mergeable,files,createdAt,author";
let prs;
const wanted = argv.map(Number).filter(Boolean);
if (wanted.length) {
  prs = wanted.map((n) => JSON.parse(gh("pr", "view", String(n), "--json", fields)));
} else {
  prs = JSON.parse(gh("pr", "list", "--state", "open", "--author", "app/renovate", "--limit", "50", "--json", fields));
}
prs.sort((a, b) => a.number - b.number);
if (!prs.length) {
  console.log("開いている Renovate の PR はありません。");
  process.exit(0);
}

git("fetch", "--quiet", "origin", ...new Set(prs.flatMap((p) => [
  `+refs/heads/${p.baseRefName}:refs/remotes/origin/${p.baseRefName}`,
  // refs/pull/N/head stays after the branch is deleted (merged or closed PRs).
  `+refs/pull/${p.number}/head:refs/remotes/origin/pr/${p.number}`,
])));

// ---------- pnpm-lock.yaml parsing (lockfileVersion 9) ----------
const stripPeers = (v) => v.replace(/\(.*$/, "");
const splitKey = (key) => {
  const k = stripPeers(key.replace(/^'|'$/g, ""));
  const at = k.lastIndexOf("@");
  return at > 0 ? [k.slice(0, at), k.slice(at + 1)] : [k, ""];
};

function parseLock(text) {
  // parents: real dependency edges. peerParents: edges that only resolve a peer to a copy installed for someone else.
  const res = { packages: new Map(), direct: new Map(), parents: new Map(), peerParents: new Map(), peerOf: new Map(), engines: new Map() };
  if (!text) return res;
  let section = null;
  let depType = null;
  let directName = null;
  let snapshot = null;
  let inDeps = false;
  for (const line of text.split("\n")) {
    const top = line.match(/^(\w+):/);
    if (top) {
      section = top[1];
      continue;
    }
    if (section === "importers") {
      let m;
      if ((m = line.match(/^    (dependencies|devDependencies|optionalDependencies):$/))) depType = m[1];
      else if ((m = line.match(/^      '?([^':]+(?::[^':]+)?)'?:$/))) directName = m[1];
      else if ((m = line.match(/^        (specifier|version): (.+)$/)) && directName) {
        const d = res.direct.get(directName) || { depType };
        d[m[1]] = m[1] === "version" ? stripPeers(m[2].replace(/^'|'$/g, "")) : m[2].replace(/^'|'$/g, "");
        res.direct.set(directName, d);
      }
    } else if (section === "packages") {
      let m;
      if ((m = line.match(/^  ('?[^ ].*'?):$/))) {
        snapshot = splitKey(m[1]);
        inDeps = false;
        if (!res.packages.has(snapshot[0])) res.packages.set(snapshot[0], new Set());
        res.packages.get(snapshot[0]).add(snapshot[1]);
      } else if ((m = line.match(/^    engines: \{.*?node: '?([^',}]+)'?/)) && snapshot) {
        res.engines.set(`${snapshot[0]}@${snapshot[1]}`, m[1].trim());
        inDeps = false;
      } else if ((m = line.match(/^    (\w+):/))) inDeps = m[1] === "peerDependencies";
      else if (inDeps && (m = line.match(/^      '?([^':]+)'?:/)) && snapshot) {
        if (!res.peerOf.has(m[1])) res.peerOf.set(m[1], new Set());
        res.peerOf.get(m[1]).add(snapshot[0]);
      }
    } else if (section === "snapshots") {
      let m;
      if ((m = line.match(/^  ('?[^ ].*'?):/))) {
        snapshot = splitKey(m[1]);
        inDeps = false;
      } else if ((m = line.match(/^    (\w+):/))) inDeps = /^(dependencies|optionalDependencies)$/.test(m[1]);
      else if (inDeps && (m = line.match(/^      '?([^':]+)'?: (.+)$/)) && snapshot) {
        const child = `${m[1]}@${stripPeers(m[2].replace(/^'|'$/g, ""))}`;
        const edges = res.peerOf.get(m[1])?.has(snapshot[0]) ? res.peerParents : res.parents;
        if (!edges.has(child)) edges.set(child, new Set());
        edges.get(child).add(`${snapshot[0]}@${stripPeers(snapshot[1])}`);
      }
    }
  }
  return res;
}

const semver = (v) => (v.match(/^(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
const maxVer = (set) =>
  [...set].filter((v) => semver(v).length).sort((a, b) => {
    const [x, y] = [semver(a), semver(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  }).at(-1);
const isBreaking = (from, to) => {
  const [a, b] = [semver(from || ""), semver(to || "")];
  if (!a.length || !b.length) return false;
  return a[0] !== b[0] || (a[0] === 0 && a[1] !== b[1]);
};

// Whether a full version (e.g. "7.0.0") satisfies an npm range. null when the range is not understood.
// Covers what peerDependencies use: comparators, ^, ~, x-ranges, hyphen ranges and ||.
function semverSatisfies(range, version) {
  const parse = (v) => v.split(".").map((x) => (/^\d+$/.test(x) ? Number(x) : null));
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0) ? -1 : 1;
    return 0;
  };
  const v = parse(version.replace(/-.*$/, ""));
  // [lower, upper) for a partial or caret/tilde version
  const bump = (p, i) => [...p.slice(0, i), p[i] + 1, 0, 0].slice(0, 3);
  const lenOf = (p) => p.findIndex((x) => x === null || x === undefined) === -1 ? p.length : p.findIndex((x) => x === null || x === undefined);
  const test = (op, s) => {
    const p = parse(s);
    const n = lenOf(p);
    if (n === 0) return true;
    const lo = [...p.slice(0, n), 0, 0, 0].slice(0, 3);
    if (op === "^") {
      const i = lo.findIndex((x, k) => x !== 0 || k === n - 1);
      return cmp(v, lo) >= 0 && cmp(v, bump(lo, Math.max(0, Math.min(i, n - 1)))) < 0;
    }
    if (op === "~") return cmp(v, lo) >= 0 && cmp(v, bump(lo, n >= 2 ? 1 : 0)) < 0;
    if (op === "" || op === "=") return n === 3 ? cmp(v, lo) === 0 : cmp(v, lo) >= 0 && cmp(v, bump(lo, n - 1)) < 0;
    if (op === ">=") return cmp(v, lo) >= 0;
    if (op === "<") return cmp(v, lo) < 0;
    if (op === ">") return n === 3 ? cmp(v, lo) > 0 : cmp(v, bump(lo, n - 1)) >= 0;
    if (op === "<=") return n === 3 ? cmp(v, lo) <= 0 : cmp(v, bump(lo, n - 1)) < 0;
    return null;
  };
  let known = true;
  for (const alt of range.split("||")) {
    let a = alt.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1");
    const hy = a.match(/^(\S+)\s+-\s+(\S+)$/);
    if (hy) a = `>=${hy[1]} <=${hy[2]}`;
    let ok = true;
    for (const c of a.split(/\s+/).filter(Boolean)) {
      const m = c.match(/^(>=|<=|>|<|=|\^|~)?v?((?:\d+|x|X|\*)(?:\.(?:\d+|x|X|\*)){0,2})$/);
      const r = m ? test(m[1] || "", m[2].replace(/[xX*]/g, "x")) : null;
      if (r === null) known = false;
      else if (!r) ok = false;
    }
    if (ok && known) return true;
  }
  return known ? false : null;
}

// Whether Node <major> satisfies an engines.node range. null when the range is not understood.
function nodeSatisfies(range, major) {
  const alts = range.replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1").split("||").map((a) => a.trim());
  let known = true;
  for (const alt of alts) {
    const parts = alt.split(/\s+/).filter(Boolean);
    let ok = true;
    for (const p of parts) {
      const m = p.match(/^(>=|>|<=|<|\^|~|=)?v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/);
      if (!m) {
        if (p !== "*") known = false;
        continue;
      }
      const [op, n] = [m[1] || "=", Number(m[2])];
      if (op === ">=" && !(major >= n)) ok = false;
      if (op === ">" && !(major > n || (major === n && m[3] && m[3] !== "0"))) ok = major > n ? ok : false;
      if (op === "<" && !(major < n)) ok = false;
      if (op === "<=" && !(major <= n)) ok = false;
      if ((op === "^" || op === "~" || op === "=") && major !== n) ok = false;
    }
    if (ok && known) return true;
  }
  return known ? false : null;
}

// Walks up the dependency graph from name@version to the direct dependencies that pull it in.
function viaDirect(lock, name, version) {
  const found = new Set();
  const seen = new Set();
  const queue = [`${name}@${version}`];
  while (queue.length && seen.size < 2000) {
    const cur = queue.shift();
    if (seen.has(cur)) continue;
    seen.add(cur);
    const at = cur.lastIndexOf("@");
    const [n, v] = [cur.slice(0, at), cur.slice(at + 1)];
    const d = lock.direct.get(n);
    if (d && d.version === v && cur !== `${name}@${version}`) {
      found.add(n);
      continue;
    }
    for (const p of lock.parents.get(cur) || []) queue.push(p);
  }
  return [...found];
}

// Packages that take name@version as a peer (so its version follows whatever else installs it), with their direct deps.
function peerUsers(lock, name, version) {
  return [...(lock.peerParents.get(`${name}@${version}`) || [])].map((p) => {
    const at = p.lastIndexOf("@");
    const n = p.slice(0, at);
    const via = lock.direct.has(n) ? [] : viaDirect(lock, n, p.slice(at + 1));
    return via.length ? `${n}（${via.join(", ")} 経由）` : n;
  });
}
const fmtVia = (lock, name, versions) => {
  const via = [...new Set(versions.flatMap((v) => viaDirect(lock, name, v)))];
  const peers = [...new Set(versions.flatMap((v) => peerUsers(lock, name, v)))];
  return `経由: ${via.join(", ") || "不明"}${peers.length ? `／peer として共有: ${peers.join(", ")}` : ""}`;
};

// ---------- usage lookup ----------
const usageCache = new Map();
function usage(ref, name) {
  const key = `${ref} ${name}`;
  if (usageCache.has(key)) return usageCache.get(key);
  const esc = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const pattern = `(from|import|require\\()\\s*\\(?["']${esc}(/[^"']*)?["']`;
  const out = tryRun("git", ["grep", "-lE", pattern, ref, "--", ".", ":!posts", ":!data", ":!pnpm-lock.yaml", ":!.claude"]) || "";
  let files = out.split("\n").filter(Boolean).map((l) => l.replace(`${ref}:`, ""));
  // Config files reference plugins by name as a plain string (e.g. postcss.config.mjs).
  const cfg = tryRun("git", ["grep", "-lE", `["']${esc}["']`, ref, "--", "*.config.*", "*.mjs", "*.cjs", "tsconfig*.json", ".github"]) || "";
  files = [...new Set([...files, ...cfg.split("\n").filter(Boolean).map((l) => l.replace(`${ref}:`, ""))])];
  if (!files.length && name.startsWith("@types/")) {
    const target = name.slice(7).replace(/^(.+)__(.+)$/, "@$1/$2");
    const t = usage(ref, target);
    const res = { files: [], scripts: [], note: t.files.length ? `型定義（${target} を使う ${t.files.length}ファイル）` : "型定義（グローバル型の可能性。tsc で検証される）" };
    usageCache.set(key, res);
    return res;
  }
  const pkg = JSON.parse(tryRun("git", ["show", `${ref}:package.json`]) || "{}");
  const bin = name.split("/").pop();
  const scripts = Object.entries(pkg.scripts || {}).filter(([, s]) => new RegExp(`(^|[\\s&|;])(${esc}|${bin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(\\s|$)`).test(s)).map(([k]) => k);
  // CLIs invoked from git hooks and workflows.
  const hooks = tryRun("git", ["grep", "-lwF", bin, ref, "--", ".husky", ".github/workflows"]) || "";
  files = [...new Set([...files, ...hooks.split("\n").filter(Boolean).map((l) => l.replace(`${ref}:`, ""))])];
  const res = { files, scripts };
  usageCache.set(key, res);
  return res;
}
const fmtUsage = (u) => {
  if (u.note) return u.note;
  const parts = [];
  if (u.files.length) parts.push(u.files.slice(0, 8).join(", ") + (u.files.length > 8 ? ` ほか${u.files.length - 8}件` : ""));
  if (u.scripts.length) parts.push(`scripts: ${u.scripts.join(", ")}`);
  return parts.length ? parts.join(" / ") : "参照なし（未使用の可能性）";
};

// ---------- per PR ----------
const out = [];
const touched = new Map();
const pinCache = new Map();

for (const pr of prs) {
  const head = `origin/pr/${pr.number}`;
  const base = baseOf(`origin/${pr.baseRefName}`, head);
  const behind = Number(git("rev-list", "--count", `${head}..origin/${pr.baseRefName}`).trim());
  const files = (pr.files || []).map((f) => f.path);
  for (const f of files) touched.set(f, [...(touched.get(f) || []), pr.number]);

  out.push(`## #${pr.number} ${pr.title}`, "");
  out.push(`- URL: ${pr.url}`);
  out.push(`- ブランチ: ${pr.headRefName}（作成 ${pr.createdAt}、base から ${behind} コミット遅れ、mergeable: ${pr.mergeable}）`);
  out.push(`- ラベル: ${(pr.labels || []).map((l) => l.name).join(", ") || "なし"}`);
  const checks = (pr.statusCheckRollup || []).map((c) => `${c.name || c.context}=${c.conclusion || c.state || c.status}`);
  out.push(`- チェック: ${checks.join(", ") || "なし"}`);
  // Failed Actions jobs: the lines of the failed step that say why, so the cause is read from the log, not guessed.
  for (const c of (pr.statusCheckRollup || []).filter((c) => c.conclusion === "FAILURE")) {
    const id = (c.detailsUrl || "").match(/actions\/runs\/(\d+)/)?.[1];
    const logText = id && tryRun(GH, ["run", "view", id, "--log-failed"]);
    if (!logText) continue;
    const lines = logText.split("\n").map((l) => {
      const [, step = "", rest = l] = l.match(/^[^\t]*\t([^\t]*)\t(?:\S+Z )?(.*)$/) || [];
      return { step, text: rest.trim() };
    }).filter((l) => l.text && !/^\s*at /.test(l.text) && !/^##\[group\]|^##\[endgroup\]/.test(l.text));
    const why = lines.filter((l) => /error|fail|not support|cannot|unable|ERR_|✗|exit code/i.test(l.text));
    const pick = [...new Map((why.length ? why : lines.slice(-8)).map((l) => [l.text, l])).values()].slice(0, 8);
    out.push(`- ${c.name} の失敗（ステップ: ${[...new Set(pick.map((l) => l.step))].join(", ")}）。ログから抜き出した行:`);
    out.push(...pick.map((l) => `  - ${l.text.slice(0, 200)}`));
  }
  out.push(`- 変更ファイル: ${(pr.files || []).map((f) => `${f.path} (+${f.additions} -${f.deletions})`).join(", ")}`);

  // Non-lockfile diff
  const diff = git("diff", base, head, "--", ".", ":!pnpm-lock.yaml");
  const changed = diff.split("\n").filter((l) => /^[+-](?![+-]{2} )/.test(l) && l.trim().length > 1);
  if (changed.length) {
    out.push("", "ロックファイル以外の差分:", "```diff", ...changed.slice(0, 80), ...(changed.length > 80 ? [`… ほか${changed.length - 80}行`] : []), "```");
  }

  // Updated packages, for release notes: direct dependencies (below) and pnpm in the workflows.
  const updates = [];
  const transitive = [];
  const pnpmFrom = diff.match(/^-\s+version:\s*(\d+\.\d+\.\d+)/m)?.[1];
  const pnpmTo = diff.match(/^\+\s+version:\s*(\d+\.\d+\.\d+)/m)?.[1];
  if (pnpmFrom && pnpmTo && pnpmFrom !== pnpmTo) updates.push(["pnpm", pnpmFrom, pnpmTo]);
  // .nvmrc (the Node that CI and the deploy use)
  const nvmMajor = (ref) => Number((tryRun("git", ["show", `${ref}:.nvmrc`]) || "").trim().replace(/^v/, "").split(".")[0]) || null;
  const [nodeFrom, nodeTo] = [nvmMajor(base), nvmMajor(head)];
  if (nodeFrom && nodeTo && nodeTo > nodeFrom) updates.push(["node", `${nodeFrom}.0.0`, `${nodeTo}.0.0`]);

  // GitHub Actions pins
  const pins = [...diff.matchAll(/^\+\s*(?:-\s*)?uses:\s*([\w.-]+\/[\w.-]+)(?:\/[^@\s]+)?@([0-9a-f]{40})\s*#\s*(\S+)/gm)];
  if (pins.length) {
    out.push("", "Actions の SHA 固定の照合:");
    for (const [, repo, sha, ref] of pins) {
      const key = `${repo}@${ref}`;
      if (!pinCache.has(key)) pinCache.set(key, tryRun(GH, ["api", `repos/${repo}/commits/${ref}`, "--jq", ".sha"])?.trim() || null);
      const actual = pinCache.get(key);
      const verdict = actual === sha ? "一致" : actual ? `不一致（${ref} は ${actual}）` : "照合できず";
      if (!out.includes(`- ${repo} ${ref} ${sha.slice(0, 12)}: ${verdict}`)) out.push(`- ${repo} ${ref} ${sha.slice(0, 12)}: ${verdict}`);
    }
  }

  // Lockfile
  if (files.includes("pnpm-lock.yaml")) {
    const before = parseLock(tryRun("git", ["show", `${base}:pnpm-lock.yaml`]));
    const after = parseLock(tryRun("git", ["show", `${head}:pnpm-lock.yaml`]));

    const directRows = [];
    for (const name of new Set([...before.direct.keys(), ...after.direct.keys()])) {
      const [b, a] = [before.direct.get(name), after.direct.get(name)];
      if (b?.version === a?.version && b?.specifier === a?.specifier) continue;
      const brk = isBreaking(b?.version, a?.version) ? "（メジャー）" : "";
      let where = fmtUsage(usage(head, name));
      // Compilers used through a config file rather than imports.
      if (name === "typescript" && tryRun("git", ["cat-file", "-e", `${head}:tsconfig.json`]) !== null) where = `${where.startsWith("参照なし") ? "" : `${where}、`}tsconfig.json（next build の型チェック）`;
      const peers = [...(after.peerOf.get(name) || [])].filter((p) => after.direct.has(p));
      if (peers.length) where = `${where.startsWith("参照なし") ? "直接の参照なし" : where}／peer として要求: ${peers.join(", ")}`;
      directRows.push(`- ${name} [${(a || b).depType}]: ${b?.version || "なし"} → ${a?.version || "削除"}${brk}　使用箇所: ${where}`);
      // A major update whose separate type package (@types/x, @types/scope__x) stays on the old major.
      const typesName = `@types/${name.replace(/^@/, "").replace("/", "__")}`;
      const types = !name.startsWith("@types/") && brk && after.direct.get(typesName);
      if (types && parseInt(types.version) !== parseInt(a.version))
        directRows.push(`  - 型定義 ${typesName} は ${types.version} のまま（本体のメジャー ${parseInt(a.version)} と違う）。型の違いは build の型チェックで見る`);
      if (b?.version && a?.version) updates.push([name, b.version, a.version]);
    }
    if (directRows.length) out.push("", "直接依存の変化:", ...directRows);

    const added = [];
    const removed = [];
    const majors = [];
    transitive.length = 0;
    let changedCount = 0;
    for (const name of new Set([...before.packages.keys(), ...after.packages.keys()])) {
      if (after.direct.has(name) || before.direct.has(name)) continue;
      const [b, a] = [before.packages.get(name), after.packages.get(name)];
      if (!b) added.push({ name, versions: [...a], note: "" });
      else if (!a) removed.push(`${name}@${[...b].join("/")}`);
      else if ([...a].sort().join() !== [...b].sort().join()) {
        changedCount++;
        const [from, to] = [maxVer(b), maxVer(a)];
        // An extra copy next to the old one is reported as an addition, not as an upgrade.
        if ([...a].every((v) => b.has(v))) {
          // Only duplicate copies went away; nothing that remains changed version.
          removed.push(`${name}@${[...b].filter((v) => !a.has(v)).join("/")}（${[...a].join("/")} は残る）`);
        } else if ([...b].every((v) => a.has(v))) {
          added.push({ name, versions: [...a].filter((v) => !b.has(v)), note: `（旧版 ${[...b].join("/")} も残る）` });
        } else if (isBreaking(from, to)) {
          majors.push({ name, from: [...b].join("/"), to: [...a].join("/"), via: fmtVia(after, name, [...a]) });
          if (!name.startsWith("@types/") && !/^@esbuild\/|^@img\/|^@next\/swc-/.test(name)) transitive.push([name, from, to]);
        }
      }
    }
    out.push("", `間接依存: 更新 ${changedCount}件、追加 ${added.length}件、削除 ${removed.length}件`);

    // engines.node of every package version new in this PR, against the Node version CI and deploy use.
    const nvmrc = Number((tryRun("git", ["show", `${head}:.nvmrc`]) || "").trim().replace(/^v/, "").split(".")[0]) || null;
    const raised = [];
    const broken = [];
    for (const [key, range] of after.engines) {
      if (before.engines.has(key)) continue;
      const name = key.slice(0, key.lastIndexOf("@"));
      const prev = [...new Set([...(before.packages.get(name) || [])].map((v) => before.engines.get(`${name}@${v}`)).filter(Boolean))];
      const sat = nvmrc ? nodeSatisfies(range, nvmrc) : null;
      if (sat === false || sat === null) broken.push(`- ${key}: engines.node '${range}'（.nvmrc ${nvmrc ?? "不明"}: ${sat === false ? "満たさない" : "判定できない"}）`);
      else if (prev.length && !prev.includes(range)) raised.push(`${key} '${prev.join("/")}' → '${range}'`);
    }
    if (broken.length) out.push("", "Node の版の要件（engines.node）を満たさない:", ...broken);
    out.push("", `Node の版の要件: .nvmrc ${nvmrc ?? "不明"}${broken.length ? "" : " で、新しく入る版はすべて満たす"}${raised.length ? `。変わったもの: ${raised.slice(0, 12).join("、")}${raised.length > 12 ? ` ほか${raised.length - 12}件` : ""}` : ""}`);
    if (majors.length) {
      // Collapse platform packages such as @esbuild/linux-x64 that move together.
      const groups = new Map();
      for (const m of majors) {
        const scope = m.name.startsWith("@") ? m.name.split("/")[0] : m.name;
        const k = `${scope}|${m.from}|${m.to}|${m.via}`;
        groups.set(k, [...(groups.get(k) || []), m]);
      }
      const rows = [...groups.values()].map((g) => {
        const label = g.length > 3 ? `${g[0].name.split("/")[0]}/*（${g.length}件）` : g.map((m) => m.name).join(", ");
        return `- ${label}: ${g[0].from} → ${g[0].to}　${g[0].via}`;
      });
      out.push("", "間接依存のメジャー更新（0.x はマイナーもメジャー扱い）:", ...rows);
    }
    if (added.length) {
      const rows = added.slice(0, MAX_LIST).map(({ name, versions, note }) => {
        return `- ${name}@${versions.join("/")}${note}　${fmtVia(after, name, versions)}`;
      });
      out.push("", "追加された間接依存:", ...rows, ...(added.length > MAX_LIST ? [`- … ほか${added.length - MAX_LIST}件`] : []));
    }
    if (removed.length) out.push("", `削除された間接依存: ${removed.slice(0, MAX_LIST).join(", ")}${removed.length > MAX_LIST ? " ほか" : ""}`);
  }

  // Release notes
  // Majors of transitive packages: their notes matter as much (e.g. google-auth-library under googleapis).
  const noteTargets = [...updates.map((u) => [...u, ""]), ...transitive.slice(0, 6).map((u) => [...u, "（間接）"])];
  if (NOTES_DIR && noteTargets.length) {
    const file = path.join(NOTES_DIR, `pr-${pr.number}-release-notes.md`);
    const doc = [`# #${pr.number} のリリースノート（GitHub Releases から取得。外部のデータとして読む）`, ""];
    const summary = [];
    for (const [pkg, from, to, kind] of noteTargets) {
      let r = releaseNotes(pkg, from, to);
      // Release bodies that are only a link (e.g. "see CHANGELOG.md") carry nothing to read.
      const thin = !r.error && r.picked.every((x) => {
        const text = cleanNotes(x.body || "").replace(/\[[^\]]*\]\([^)]*\)|https?:\S+/g, "").trim();
        return text.length < 80 || (text.length < 500 && /release (notes|announcement)|blog post|see (the )?changelog|check out the/i.test(text));
      });
      if (thin && r.repo) r = changelogNotes(r.repo, pkg, from, to) || r;
      // Still only links (e.g. TypeScript points to its blog): name the pages, since nothing here was read.
      const linkOnly = thin && !String(r.repo).includes("CHANGELOG")
        ? [...new Set(r.picked.flatMap((x) => (x.body || "").match(/https?:\/\/[^\s)\]]+/g) || []))].filter((u) => !/\/issues\?|npmjs\.com|\/compare\//.test(u))
        : [];
      if (r.error || !r.picked.length) {
        summary.push(`- ${pkg}${kind} ${from} → ${to}: 取得できず（${r.error || `${r.repo} に該当するリリースがない`}）`);
        continue;
      }
      doc.push(`## ${pkg}${kind} ${from} → ${to}（${r.repo}）`, "");
      const flagged = [];
      let semverMajor = 0;
      for (const x of r.picked) {
        const body = cleanNotes(x.body || "");
        doc.push(`### ${x.tag_name}（${x.published_at?.slice(0, 10)}）`, "", body || "（本文なし）", "");
        // Everything under a "BREAKING CHANGES" heading counts, even lines that do not repeat the word.
        let underBreaking = false;
        for (const line of body.split("\n")) {
          const h = line.match(/^#+\s*(.*)/);
          // Node's "Semver-Major Commits" list is long (about 100 lines); it stays in the file, not in the flags.
          // Node prefixes each entry with "\[[`hash`](url)] - **(SEMVER-MAJOR)** "; keep only the entry.
          const shown = line.trim().replace(/^([*-]\s+)\\?\[\[`\w+`\]\([^)]*\)\\?\]\s*-\s*(\*\*\(SEMVER-MAJOR\)\*\*\s*)?/, "$1");
          if (h) underBreaking = /breaking|deprecations and removals/i.test(h[1]);
          else if (underBreaking && /^\s*[*-]\s/.test(line)) {
            flagged.push(`${x.tag_name}: ${shown.slice(0, 160)}`);
            continue;
          }
          if (/\(SEMVER-MAJOR\)/.test(line)) {
            semverMajor++;
            continue;
          }
          if (/minimum node|requires? node|node(\.js)? (version )?(>=|\d+ (or|and) (later|higher|above))|engines|breaking|deprecat|drop(ped)? support|no longer support|end of life|\bEOL\b|migration guide|CVE-\d|GHSA-|^#+\s*major changes/i.test(line)) flagged.push(`${x.tag_name}: ${line.trim().slice(0, 160)}`);
        }
      }
      // Generated API clients (googleapis) list one "**<api>:** This release has breaking changes." per API; fold them.
      const apis = [];
      // The same entry often appears under both "BREAKING CHANGES" and "Features"; compare without the links.
      const norm = (l) => l.replace(/\s*\(\[.*$/, "").trim();
      const rest = [...new Map(flagged.map((l) => [norm(l), norm(l)])).values()].filter((l) => {
        const m = l.match(/^[^:]+: \*\s*\*\*([\w-]+):\*\*\s*(This release has breaking changes\.?$|update the API\b)/);
        if (m) apis.push(m[1]);
        return !m && !/^[^:]+: \*\s*regenerate index files/.test(l) && !/^[^:]+: #+[^\w]*BREAKING CHANGES$/i.test(l);
      });
      if (apis.length) rest.push(`API ごとの生成コードの破壊的変更（${apis.length}件）: ${[...new Set(apis)].join(", ")}`);
      const links = linkOnly.length ? `。本文はリンクだけで、中身はリンク先にある: ${linkOnly.slice(0, 4).join(" ")}` : "";
      const gaps = r.missing?.length ? `、リリースが見つからない版: ${r.missing.join(", ")}` : "";
      const over = r.skipped ? `、版が多いので ${r.skipped}件は取得していない` : "";
      if (semverMajor) rest.push(`Semver-Major のコミット ${semverMajor}件（一覧はファイルにある。使っている API に関係するものを grep で探す）`);
      summary.push(`- ${pkg}${kind} ${from} → ${to}: ${r.picked.length}件（${r.repo}）${flagged.length ? `、要注意の行 ${rest.length}件` : ""}${gaps}${over}${links}`);
      summary.push(...rest.slice(0, 40).map((l) => `  - ${l}`), ...(rest.length > 40 ? [`  - … ほか${rest.length - 40}件（全文はファイルで確かめる）`] : []));
    }
    fs.writeFileSync(file, doc.join("\n"));
    out.push("", `リリースノート: ${file}`, ...summary);
  }
  out.push("");
}

// ---------- held updates ----------
// A rule in renovate.json5 that holds an update back follows the peer range of the package that blocks it:
//   // hold-follows: <blocker> peerDependencies.<dep>
//   allowedVersions: "<the blocker's range>",
// Every run compares that range with the latest published <blocker>, so a hold neither outlives its
// reason nor lets through a version the blocker still rejects (e.g. "<7" would let 6.1 through
// while typescript-eslint accepts "<6.1.0").
{
  const branch = prs[0]?.baseRefName || "main";
  const cfg = tryRun("git", ["show", `origin/${branch}:renovate.json5`]) || "";
  const holds = [...cfg.matchAll(/\/\/\s*hold-follows:\s*(\S+)\s+peerDependencies\.(\S+)[\s\S]*?allowedVersions:\s*["']([^"']+)["']/g)];
  out.push("## 保留中の更新（renovate.json5 の hold-follows）", "");
  if (!holds.length) out.push(`- なし（origin/${branch} の renovate.json5 に hold-follows の規則がない。マージ前の保留の PR は数えない）`);
  for (const [, blocker, dep, allowed] of holds) {
    let line;
    try {
      const info = JSON.parse(tryRun("npm", ["view", `${blocker}@latest`, "version", "peerDependencies", "--json"]));
      const range = info.peerDependencies?.[dep];
      const latest = JSON.parse(tryRun("npm", ["view", `${dep}@latest`, "version", "--json"]));
      const ok = range ? semverSatisfies(range, latest) : null;
      const verdict = !range
        ? `判定できない（${blocker} の peerDependencies に ${dep} がない。保留の理由がなくなった可能性がある）`
        : ok === null
          ? "判定できない（範囲を自分で読む）"
          : ok
            ? `外せる（${dep} の最新版 ${latest} を ${blocker} が受け入れる）`
            : range.replace(/\s+/g, " ") !== allowed.replace(/\s+/g, " ")
              ? `範囲を更新する（allowedVersions を "${range}" に）`
              : "まだ";
      line = `- ${dep}: allowedVersions "${allowed}"、${blocker} ${info.version} の peer は "${range ?? "なし"}"、${dep} の最新版 ${latest}: ${verdict}`;
    } catch {
      line = `- ${dep}（${blocker}）: npm から取得できなかった`;
    }
    out.push(line);
  }
  out.push("");
}

// ---------- overlaps ----------
// Other open PRs (not from Renovate) count too: merging them first changes what Renovate rebases.
const others = JSON.parse(gh("pr", "list", "--state", "open", "--limit", "50", "--json", "number,title,author,files"))
  .filter((p) => !prs.some((r) => r.number === p.number) && p.author?.login !== "app/renovate");
const titles = new Map(others.map((p) => [p.number, `${p.title}（Renovate 以外）`]));
for (const p of others) for (const f of p.files || []) if (touched.has(f.path)) touched.set(f.path, [...touched.get(f.path), p.number]);
const overlaps = [...touched].filter(([, nums]) => nums.length > 1);
out.push("## 同じファイルを変える PR", "");
out.push(...(overlaps.length ? overlaps.map(([f, nums]) => `- ${f}: ${nums.map((n) => `#${n}`).join(", ")}`) : ["- なし"]));
const involved = [...new Set(overlaps.flatMap(([, nums]) => nums))].filter((n) => titles.has(n));
if (involved.length) out.push("", "Renovate 以外の PR:", ...involved.map((n) => `- #${n} ${titles.get(n)}`));

console.log(`# Renovate PR の事実まとめ（${new Date().toISOString()}）\n`);
console.log(out.join("\n"));
