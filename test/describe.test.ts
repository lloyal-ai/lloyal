/**
 * Tests for the publish-time attention-surface extraction. The "real app" cases
 * construct the actual built first-party apps in an isolated subprocess and read
 * their tool schemas (the genuinely novel mechanism); the fallback case proves a
 * non-constructable app degrades LOUDLY to tool NAMES rather than throwing.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAttentionSurface } from '../src/describe';

// The two "real first-party app" cases lived here and are gone with the repo
// split. They constructed @lloyal-labs/{wikipedia,corpus}-app in a subprocess,
// which needs those apps built AND `effection` + `@lloyal-labs/lloyal-agents`
// resolvable — and that chain reaches the native `lloyal.node`. Installing it
// as a devDependency would give this repo the native dependency whose absence
// is the entire reason the CLI is a separate package.
//
// So the subprocess construction path is UNCOVERED here. What remains is the
// fallback contract, which is hermetic and is the part that protects users: a
// non-constructable app degrades loudly rather than silently publishing an
// empty surface. Tracked as lloyal-ai/lloyal#1.

describe('buildAttentionSurface — fallback', () => {
  it('degrades LOUDLY to app.json tool NAMES when the app cannot be constructed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'describe-fallback-'));
    await mkdir(join(dir, 'dist'), { recursive: true });
    // A dist that throws on require + no node_modules → subprocess fails → fallback.
    await writeFile(join(dir, 'dist', 'index.js'), 'throw new Error("boom");');
    await writeFile(join(dir, 'skill.eta'), 'the skill template');
    const app: DescribeAppJson = {
      name: 'broken',
      protocol: { name: 'broken_protocol', useWhen: 'never', tools: ['alpha', 'beta'] },
    };
    const pkg: DescribePackageJson = { name: '@x/broken', version: '1.0.0', main: 'dist/index.js' };

    const s = await buildAttentionSurface(dir, app, pkg);
    expect(s.degraded).toBe(true);
    expect(s.tools.map((t) => t.name)).toEqual(['alpha', 'beta']);
    expect(s.tools.every((t) => t.description === '' && t.parameters === null)).toBe(true);
    expect(s.skill).toBe('the skill template'); // skill.eta still read
    expect(s.protocol.useWhen).toBe('never');
  }, 60_000);
});
