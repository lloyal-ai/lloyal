/**
 * Tests for the publish-time attention-surface extraction. The "real ability" cases
 * construct the actual built first-party abilities in an isolated subprocess and read
 * their tool schemas (the genuinely novel mechanism); the fallback case proves a
 * non-constructable ability degrades LOUDLY to tool NAMES rather than throwing.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAttentionSurface } from '../src/describe';

// The real-construction cases live in `describe-scaffolded-ability.test.ts`, which
// scaffolds an ability with `ability:new` and extracts from it. They used to construct
// @lloyal-labs/{wikipedia,corpus}-ability, which were convenient fixtures sitting
// prebuilt in the monorepo — not a requirement. `buildAttentionSurface` takes a
// directory and has no notion of who published it; a scaffolded third-party ability
// is what real publishers push through `publish`, so it is the better fixture.
//
// What remains HERE is the fallback contract, and it is worth keeping separate:
// it needs no install and no build, and it asserts the safety behaviour — an ability
// that cannot be constructed degrades LOUDLY to tool names rather than silently
// publishing an empty surface.

describe('buildAttentionSurface — fallback', () => {
  it('degrades LOUDLY to ability.json tool NAMES when the ability cannot be constructed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'describe-fallback-'));
    await mkdir(join(dir, 'dist'), { recursive: true });
    // A dist that throws on require + no node_modules → subprocess fails → fallback.
    await writeFile(join(dir, 'dist', 'index.js'), 'throw new Error("boom");');
    await writeFile(join(dir, 'skill.eta'), 'the skill template');
    const ability: DescribeAbilityJson = {
      name: 'broken',
      protocol: { name: 'broken_protocol', useWhen: 'never', tools: ['alpha', 'beta'] },
    };
    const pkg: DescribePackageJson = { name: '@x/broken', version: '1.0.0', main: 'dist/index.js' };

    const s = await buildAttentionSurface(dir, ability, pkg);
    expect(s.degraded).toBe(true);
    expect(s.tools.map((t) => t.name)).toEqual(['alpha', 'beta']);
    expect(s.tools.every((t) => t.description === '' && t.parameters === null)).toBe(true);
    expect(s.skill).toBe('the skill template'); // skill.eta still read
    expect(s.protocol.useWhen).toBe('never');
  }, 60_000);
});
