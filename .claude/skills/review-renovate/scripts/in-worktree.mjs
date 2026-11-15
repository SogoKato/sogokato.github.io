#!/usr/bin/env node
// Runs a command inside a fix worktree, and refuses to run it anywhere else.
// Usage: node .claude/skills/review-renovate/scripts/in-worktree.mjs <worktree dir> -- <command> [args...]
//
// With `cd <dir> && cmd`, a failed `git worktree add` leaves the shell in the main working tree,
// and `pnpm install` there replaces the node_modules the dev server uses. This script checks that
// <dir> exists, is the top of a linked worktree (not the main one) and sits outside the repository,
// then runs the command with that directory as its cwd.

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
const [cmd, ...argv] = args.slice(2);
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

// verify.mjs cleans up other sessions' fix worktrees; this pid (in the git dir, so `git add -A`
// never picks it up) tells it this one is in use while the command runs.
const pidFile = path.join(gitDir, "verify-pid");
fs.writeFileSync(pidFile, String(process.pid));
const r = spawnSync(cmd, argv, { cwd: dir, stdio: "inherit" });
fs.rmSync(pidFile, { force: true });
if (r.error) fail(`${cmd} を起動できない: ${r.error.message}`);
process.exit(r.status ?? 1);
