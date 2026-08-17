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
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** What `spawnNpm` decided to run. Separated from the spawn so it is testable. */
export interface NpmInvocation {
  cmd: string;
  argv: string[];
  /** Owned by this module — see `spawnNpm`, which overrides any caller value. */
  shell: boolean;
}

/**
 * Quote one argument for a Windows command line.
 *
 * The trailing-backslash case is the one that bites: `C:\\tmp\\` naively quoted
 * becomes `"C:\\tmp\\"`, and the final backslash escapes the closing quote at the
 * CommandLineToArgvW layer, swallowing the next argument. Windows paths ending
 * in a separator are ordinary, so the rule is: double every backslash run that
 * precedes a quote or the end of the argument, then wrap.
 */
export function quoteForWindows(arg: string): string {
  if (arg.length > 0 && !/[\s"^&|<>%!\\]/.test(arg)) return arg;
  const escaped = arg
    .replace(/(\\*)"/g, '$1$1\\"')  // backslashes before an embedded quote, then the quote
    .replace(/(\\*)$/, '$1$1');       // backslashes before the closing quote
  return `"${escaped}"`;
}

/**
 * Decide how to invoke npm. Pure: no spawn, no environment reads beyond the
 * arguments given, so every branch — including the Windows one that cannot run
 * on this machine — is directly testable.
 */
export function npmCliCandidates(nodeExecPath: string, platform: NodeJS.Platform): string[] {
  const dir = dirname(nodeExecPath);
  // Windows ships npm beside node.exe; POSIX puts it a level up in lib/.
  return platform === 'win32'
    ? [join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js')]
    : [join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')];
}

export function resolveNpmInvocation(
  args: readonly string[],
  platform: NodeJS.Platform,
  npmExecPath: string | undefined,
  nodeExecPath: string = process.execPath,
  fileExists: (p: string) => boolean = existsSync,
): NpmInvocation {
  // 1. npm told us where it lives (npm, npx).
  if (npmExecPath && /\.[cm]?js$/i.test(npmExecPath)) {
    return { cmd: nodeExecPath, argv: [npmExecPath, ...args], shell: false };
  }
  // 2. Find npm's JS entry beside node. This exists to keep Windows OFF cmd.exe:
  //    under `shell: true`, cmd expands %VAR% even inside double quotes, and
  //    there is no escape for that in an argument passed to `cmd /c`. Since
  //    `lloyal install <publisher>/<name>` puts caller-supplied text on this
  //    path, running npm's JS directly is the only way to keep it uninterpreted.
  const found = npmCliCandidates(nodeExecPath, platform).find(fileExists);
  if (found) {
    return { cmd: nodeExecPath, argv: [found, ...args], shell: false };
  }
  if (platform !== 'win32') {
    return { cmd: 'npm', argv: [...args], shell: false };
  }
  // 3. Last resort. Quoting handles spaces and trailing backslashes; `%` remains
  //    expandable by cmd and cannot be escaped here, so this path is reached only
  //    when npm's JS entry is genuinely absent.
  return { cmd: 'npm.cmd', argv: args.map(quoteForWindows), shell: true };
}

/**
 * Run `npm <args>`.
 *
 * NOT a drop-in for `spawn('npm', …)` in one respect, deliberately: `opts.shell`
 * is IGNORED. Whether a shell is used is a consequence of how npm was resolved —
 * a caller passing `shell: true` alongside the node-entry path would break the
 * argument passing this module exists to get right — so the decision stays here.
 * Every other spawn option is forwarded untouched.
 */
export function spawnNpm(
  args: readonly string[],
  opts: SpawnOptions = {},
): ChildProcess {
  const { cmd, argv, shell } = resolveNpmInvocation(
    args,
    process.platform,
    process.env.npm_execpath,
  );
  return spawn(cmd, argv, { ...opts, shell });
}
