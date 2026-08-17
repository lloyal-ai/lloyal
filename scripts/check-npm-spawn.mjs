/**
 * Fail if anything invokes npm without going through `spawnNpm`.
 *
 * On Windows npm is `npm.cmd`, which Node refuses to spawn without a shell
 * (CVE-2024-27980). Three call sites had this bug; fixing two and missing the
 * third is how `lloyal publish` stayed broken in the PR that fixed the others.
 *
 * Deliberately NOT grep: the real code reads
 *
 *     const proc = spawn(
 *       'npm',
 *
 * and a line-based match never sees it. The first version of this check was a
 * grep, and it passed against the very file it was written to catch.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const ALLOWED = 'src/npm-spawn.ts';
const CALL = /\bspawn(?:Sync)?\s*\(\s*(['"`])npm(?:\.cmd)?\1/;

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

const offenders = walk(ROOT)
  .filter((f) => f.replace(/\\/g, '/') !== ALLOWED)
  .filter((f) => CALL.test(readFileSync(f, 'utf8')));

if (offenders.length > 0) {
  console.error('Direct npm spawn found — use spawnNpm from src/npm-spawn.ts:\n');
  for (const f of offenders) console.error(`  ${f}`);
  console.error('\nOn Windows npm is npm.cmd, which Node refuses to spawn without a shell.');
  process.exit(1);
}
console.log(`OK — every npm invocation routes through spawnNpm (${walk(ROOT).length} files checked)`);
