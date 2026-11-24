#!/usr/bin/env node
// Runs a command inside a fix worktree, and refuses to run it anywhere else.
// Usage: node .claude/skills/review-renovate/scripts/in-worktree.mjs <worktree dir> -- <command> [args...]
//
// With `cd <dir> && cmd`, a failed `git worktree add` leaves the shell in the main working tree,
// and `pnpm install` there replaces the node_modules the dev server uses. This script checks that
// <dir> exists, is the top of a linked worktree (not the main one) and sits outside the repository,
// then runs the command with that directory as its cwd.
//
// It also runs only the commands a fix needs, and stops with exit code 5 for anything else. The
// Actions workflow allows this script as a whole, so without the list it would run any command for
// the agent, including the ones --allowedTools leaves out (`gh api -X PUT …/merge` merges a PR).
//   - git add, restore, switch, status, diff, show, log, rev-parse, without the options that read
//     or write files outside the worktree
//   - git commit with -m, -a and -q only
//   - git push to the branch of the same name on origin, from a fix/renovate-<n>-… or renovate/…
//     branch only, never forced
//   - npx -y pnpm@<version> install with --ignore-scripts and --ignore-pnpmfile: the agent can edit
//     package.json and write a .pnpmfile.cjs in the worktree, and install would run their code
//   - npx -y --package renovate renovate-config-validator [--strict], without a file name: given
//     one, it validates the file as global config instead of as the repository's config
// A leading `env HUSKY=0` is accepted. HUSKY=0 is set either way, and npm and pnpm get the public
// registry, so an .npmrc written into the worktree cannot swap the pnpm that npx downloads.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const sep = args.indexOf("--");
if (sep !== 1 || args.length < 3) {
  console.error("使い方: in-worktree.mjs <worktree のディレクトリ> -- <コマンド> [引数...]");
  process.exit(2);
}
const dir = path.resolve(args[0]);
const fail = (why) => {
  console.error(`実行しません: ${why}（${dir}）`);
  process.exit(2);
};
const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

if (!fs.existsSync(dir)) fail("ディレクトリがない。git worktree add が失敗していないか確かめる");
let top, gitDir, commonDir;
try {
  top = fs.realpathSync(git("rev-parse", "--show-toplevel"));
  gitDir = path.resolve(dir, git("rev-parse", "--git-dir"));
  commonDir = path.resolve(dir, git("rev-parse", "--git-common-dir"));
} catch {
  fail("git のリポジトリではない");
}
if (top !== fs.realpathSync(dir)) fail(`worktree の最上位ではない（最上位は ${top}）`);
// In the main worktree the git dir and the common dir are the same .git directory.
if (gitDir === commonDir) fail("本来の作業ディレクトリ（main の worktree）なので、ここでは動かさない");
const mainTop = path.dirname(commonDir);
if (top.startsWith(mainTop + path.sep)) fail("リポジトリの中にある worktree");

// ---------- the commands a fix needs ----------
class Denied extends Error {}
const deny = (why) => {
  throw new Denied(why);
};

const GIT_SUBCOMMANDS = new Set(["add", "restore", "switch", "status", "diff", "show", "log", "rev-parse"]);
// --output writes to any path, --pathspec-from-file reads any file (and echoes its lines in errors),
// and --no-index, an absolute path or a ".." path makes diff compare files outside the worktree.
function checkGitArg(a) {
  if (a === "--output" || a.startsWith("--output=")) deny("git の --output は使えない");
  if (a.startsWith("--pathspec-from-file")) deny("git の --pathspec-from-file は使えない");
  if (a === "--no-index") deny("git の --no-index は使えない");
  if (path.isAbsolute(a) || a.split("/").includes("..")) deny(`worktree の外を指す ${a} は使えない`);
}

// -m (the message attached or as the next word), --message, -a, --all, -q, --quiet, and paths.
function checkCommit(rest) {
  const no = (a) => deny(`git commit の ${a} は使えない（使えるのは -m、-a、-q だけ）`);
  let message = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--") break;
    if (a === "--all" || a === "--quiet") continue;
    if (a === "--message" || a.startsWith("--message=")) {
      message = true;
      if (a === "--message") i++;
      continue;
    }
    if (/^-[^-]/.test(a)) {
      const flags = a.slice(1);
      const m = flags.indexOf("m");
      if (!/^[aq]*$/.test(m < 0 ? flags : flags.slice(0, m))) no(a);
      if (m >= 0) {
        message = true;
        if (m === flags.length - 1) i++;
      }
      continue;
    }
    if (a.startsWith("-")) no(a);
  }
  if (!message) deny("git commit には -m でメッセージを渡す");
  return rest;
}

const PUSH_BRANCH = /^(fix\/renovate-\d+-[\w.-]+|renovate\/[\w./-]+)$/;
function checkPush(rest) {
  const flags = new Set();
  const words = [];
  for (const a of rest) {
    if (a === "-q" || a === "--quiet") flags.add("-q");
    else if (a === "-u" || a === "--set-upstream") flags.add("-u");
    else if (a === "-qu" || a === "-uq") flags.add("-q").add("-u");
    else if (a.startsWith("-")) deny(`git push の ${a} は使えない（強制 push や削除はしない）`);
    else words.push(a);
  }
  let branch;
  try {
    branch = git("symbolic-ref", "--short", "HEAD");
  } catch {
    deny("ブランチに乗っていない（detached HEAD）ので push しない");
  }
  if (!PUSH_BRANCH.test(branch)) deny(`push できるのは fix/renovate-<番号>-… と renovate/… のブランチだけ（今は ${branch}）`);
  const [remote = "origin", ref = "HEAD", ...extra] = words;
  if (remote !== "origin" || extra.length > 0 || (ref !== "HEAD" && ref !== branch)) {
    deny(`push できるのは origin の ${branch} だけ`);
  }
  // Name the destination, so that neither push.default nor remote.origin.push sends it elsewhere.
  return [...flags, "origin", `HEAD:refs/heads/${branch}`];
}

const VERSION = String.raw`\d+\.\d+\.\d+`;
const PNPM_FLAGS = new Set(["--frozen-lockfile", "--lockfile-only", "--ignore-scripts", "--ignore-pnpmfile"]);
function checkNpx(rest) {
  let w = rest;
  while (w[0] === "-y" || w[0] === "--yes") w = w.slice(1);
  if (new RegExp(`^pnpm@${VERSION}$`).test(w[0] ?? "")) {
    const [pkg, sub, ...flags] = w;
    if (sub !== "install" && sub !== "i") {
      deny("pnpm で動かせるのは install だけ（build や lint は、push したあと verify.mjs と CI で確かめる）");
    }
    const bad = flags.find((f) => !PNPM_FLAGS.has(f));
    if (bad) deny(`pnpm install の ${bad} は使えない`);
    for (const f of ["--ignore-scripts", "--ignore-pnpmfile"]) {
      if (!flags.includes(f)) deny(`pnpm install には ${f} を付ける（package.json のスクリプトや .pnpmfile.cjs を動かさないため）`);
    }
    return ["-y", pkg, "install", ...flags];
  }
  if (w[0] === "--package" && new RegExp(`^renovate(@${VERSION})?$`).test(w[1] ?? "") && w[2] === "renovate-config-validator") {
    const opts = w.slice(3);
    if (opts.some((a) => a !== "--strict")) {
      deny("renovate-config-validator に渡せるのは --strict だけ（ファイル名を渡すと global config として検証されるので、渡さずに worktree の設定を検証する）");
    }
    return ["-y", "--package", w[1], "renovate-config-validator", ...opts];
  }
  deny("npx で動かせるのは pnpm@<版> install と renovate-config-validator だけ");
}

function checkCommand(words) {
  let w = words;
  if (w[0] === "env") {
    w = w.slice(1);
    while (w[0] === "HUSKY=0") w = w.slice(1);
    if (w[0]?.includes("=")) deny(`env で付けられるのは HUSKY=0 だけ（${w[0]}）`);
  }
  const [cmd, ...rest] = w;
  if (cmd === "git") {
    const [sub, ...more] = rest;
    if (sub === "commit") return ["git", ["commit", ...checkCommit(more)]];
    if (sub === "push") return ["git", ["push", ...checkPush(more)]];
    if (!GIT_SUBCOMMANDS.has(sub)) deny(`git ${sub ?? ""} は動かせない`);
    more.forEach(checkGitArg);
    return ["git", [sub, ...more]];
  }
  if (cmd === "npx") return ["npx", checkNpx(rest)];
  if (cmd === "pnpm") deny("pnpm は npx -y pnpm@<版> で動かす（版は ci.yml のもの）");
  deny(`${cmd ?? ""} は動かせない`);
}

let cmd, argv;
try {
  [cmd, argv] = checkCommand(args.slice(2));
} catch (e) {
  if (!(e instanceof Denied)) throw e;
  console.error(`実行しません: ${e.message}。in-worktree.mjs で動かせるのは対処に要るコマンドだけ（SKILL.md の「作り方」）`);
  process.exit(5);
}

// verify.mjs cleans up other sessions' fix worktrees; this pid (in the git dir, so `git add -A`
// never picks it up) tells it this one is in use while the command runs.
const pidFile = path.join(gitDir, "verify-pid");
fs.writeFileSync(pidFile, String(process.pid));
const env = { ...process.env, HUSKY: "0", npm_config_registry: "https://registry.npmjs.org/" };
const r = spawnSync(cmd, argv, { cwd: dir, stdio: "inherit", env });
fs.rmSync(pidFile, { force: true });
if (r.error) fail(`${cmd} を起動できない: ${r.error.message}`);
process.exit(r.status ?? 1);
