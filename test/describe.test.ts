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

// The two "real first-party app" cases lived here and cannot follow the split.
// They constructed @lloyal-labs/{wikipedia,corpus}-app in a subprocess, and
// those apps are NOT obtainable from this repo: they are 404 on npm by design,
// distributed only through the signed channel. They exist as source in
// lloyal-ai/hdk or as signed bundles behind apps.lloyal.ai, and neither is
// reachable from a test here.
//
// (Not a dependency problem. `effection` + `@lloyal-labs/lloyal-agents` could be
// devDependencies — devDeps are never published, so they would not touch the
// zero-runtime-dep property that keeps `npx` free of a native binary. It would
// only make installs heavier. The blocker is the apps themselves. Vendoring
// them through the CLI's own verifyAndVendorApp would work but makes a unit
// test depend on the live channel and routes describe.ts through install.ts.)
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
