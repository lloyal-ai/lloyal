/**
 * One way to run npm, because Windows has three ways to get it wrong.
 *
 * Node 18.20.2 / 20.12.2 / 22+ refuse to `spawn()` a `.cmd` or `.bat` without
 * `shell: true` — the CVE-2024-27980 ("BatBadBut") fix. On Windows npm IS
 * `npm.cmd`, so every direct `spawn('npm')` or `spawn('npm.cmd')` in this CLI
 * threw `EINVAL` on Node 24: scaffold's post-install, `lloyal install`, and
 * `lloyal publish`'s `npm pack`. The whole Windows path was dead.
 *
 * Adding `shell: true` alone trades one bug for a worse one. Under a shell the
 * arguments are re-parsed by cmd.exe, and `npm pack --pack-destination <dir>`
 * carries a temp path that routinely contains a space
 * (`C:\Users\First Last\AppData\…`), which would silently split into two
 * arguments and pack to the wrong place.
 *
 * So the order of preference is:
 *
 *   1. `npm_execpath` — set by npm and npx, and it points at npm's own JS entry.
 *      Running it with the current `process.execPath` means no shell, no `.cmd`,
 *      and no quoting rules to get wrong. This is the path `npx lloyal-ai …`
 *      takes, which is how most people meet this CLI.
 *   2. POSIX — plain `spawn('npm')`, unchanged.
 *   3. Windows without `npm_execpath` — `npm.cmd` with `shell: true`, and
 *      arguments quoted here because under a shell that becomes our job.
 *
 * `cwd` is passed as a spawn option throughout and never interpolated into a
 * command string, so a directory with a space is safe on every path above.
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

const isWindows = process.platform === 'win32';

/** npm's JS entry when we were launched by npm or npx; undefined otherwise. */
function npmJsEntry(): string | undefined {
  const p = process.env.npm_execpath;
  return p && /\.[cm]?js$/i.test(p) ? p : undefined;
}

/**
 * Quote one argument for cmd.exe. Only used on the Windows fallback path —
 * every other path passes the argv array to the OS untouched.
 */
function quoteForCmd(arg: string): string {
  if (arg.length > 0 && !/[\s"^&|<>]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

/**
 * Run `npm <args>`. Drop-in for `spawn('npm', args, opts)` — same return, same
 * events — with the Windows resolution handled once instead of at each call site.
 */
export function spawnNpm(
  args: readonly string[],
  opts: SpawnOptions = {},
): ChildProcess {
  const jsEntry = npmJsEntry();
  if (jsEntry) {
    return spawn(process.execPath, [jsEntry, ...args], { ...opts, shell: false });
  }
  if (!isWindows) {
    return spawn('npm', [...args], { ...opts, shell: false });
  }
  return spawn('npm.cmd', args.map(quoteForCmd), { ...opts, shell: true });
}
