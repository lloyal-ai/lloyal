/**
 * `spawn('npm')` was dead on Windows.
 *
 * Node 18.20.2 / 20.12.2 / 22+ refuse to spawn a `.cmd` without `shell: true`
 * (CVE-2024-27980), and on Windows npm IS `npm.cmd` — so scaffold's post-install,
 * `lloyal install` and `lloyal publish` all threw EINVAL on Node 24. Reported
 * from the field, on 1.0.2, against a home directory containing a space.
 *
 * The space matters: `shell: true` alone would have fixed EINVAL and broken
 * `npm pack --pack-destination "C:\\Users\\First Last\\…"` by splitting the path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSpawn = vi.fn(() => ({ on: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mockSpawn }));

const { spawnNpm, resolveNpmInvocation } = await import('../src/npm-spawn');

const argsOf = () => mockSpawn.mock.calls[0] as unknown as [string, string[], Record<string, unknown>];
const ORIGINAL = process.env.npm_execpath;

beforeEach(() => { mockSpawn.mockClear(); });
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.npm_execpath;
  else process.env.npm_execpath = ORIGINAL;
});

describe('spawnNpm', () => {
  it('runs npm\'s JS entry with the current node when npm_execpath is set', () => {
    process.env.npm_execpath = '/usr/lib/node_modules/npm/bin/npm-cli.js';
    spawnNpm(['install'], { cwd: '/tmp/x' });
    const [cmd, argv, opts] = argsOf();
    expect(cmd).toBe(process.execPath);
    expect(argv).toEqual(['/usr/lib/node_modules/npm/bin/npm-cli.js', 'install']);
    // No shell: nothing re-parses the arguments, so nothing needs quoting.
    expect(opts.shell).toBe(false);
    expect(opts.cwd).toBe('/tmp/x');
  });

  it('ignores npm_execpath when it is not a JS entry', () => {
    // npm_execpath can point at a shim; only a .js/.cjs/.mjs entry is runnable
    // by `node`, and guessing wrong would fail at spawn rather than here.
    process.env.npm_execpath = '/usr/local/bin/npm';
    spawnNpm(['install']);
    expect(argsOf()[0]).not.toBe(process.execPath);
  });

  it('passes arguments through untouched when there is no shell', () => {
    process.env.npm_execpath = '/npm/npm-cli.js';
    const dir = '/tmp/First Last/pack out';
    spawnNpm(['pack', '--pack-destination', dir, '--json']);
    // The space-bearing path arrives as ONE argv entry, unquoted. Quoting it
    // here would make npm create a directory with literal quote marks.
    expect(argsOf()[1]).toContain(dir);
  });
});

describe('resolveNpmInvocation — every branch, including the one this machine cannot run', () => {
  const NODE = '/usr/bin/node';
  const JS = '/npm/bin/npm-cli.js';

  it('POSIX without npm_execpath runs plain npm, no shell', () => {
    expect(resolveNpmInvocation(['install'], 'darwin', undefined, NODE))
      .toEqual({ cmd: 'npm', argv: ['install'], shell: false });
  });

  it('Windows without npm_execpath needs npm.cmd AND a shell', () => {
    // Without shell:true Node throws EINVAL on a .cmd since CVE-2024-27980.
    // That is the reported bug, pinned.
    const r = resolveNpmInvocation(['install'], 'win32', undefined, NODE);
    expect(r.cmd).toBe('npm.cmd');
    expect(r.shell).toBe(true);
  });

  it('Windows quotes a path containing a space as ONE argument', () => {
    const dir = 'C:\\Users\\First Last\\tmp';
    const r = resolveNpmInvocation(['pack', '--pack-destination', dir], 'win32', undefined, NODE);
    expect(r.argv).toHaveLength(3);
    expect(r.argv[2]).toBe(`"C:\\Users\\First Last\\tmp"`);
  });

  it('Windows doubles a trailing backslash so it cannot escape the closing quote', () => {
    // `"C:\tmp\"` would let the final backslash escape the quote at the
    // CommandLineToArgvW layer and swallow the following argument.
    const r = resolveNpmInvocation(['pack', 'C:\\tmp\\', '--json'], 'win32', undefined, NODE);
    expect(r.argv[1]).toBe('"C:\\tmp\\\\"');
    expect(r.argv[2]).toBe('--json');       // the next argument survives
  });

  it('npm_execpath wins on Windows too — no shell, nothing to quote', () => {
    const dir = 'C:\\Users\\First Last\\tmp\\';
    const r = resolveNpmInvocation(['pack', dir], 'win32', JS, NODE);
    expect(r).toEqual({ cmd: NODE, argv: [JS, 'pack', dir], shell: false });
  });

  it('leaves ordinary arguments unquoted', () => {
    expect(resolveNpmInvocation(['install', '--ignore-scripts'], 'win32', undefined, NODE).argv)
      .toEqual(['install', '--ignore-scripts']);
  });
});
