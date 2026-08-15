import { parseArgs } from 'node:util';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from '../command.js';

const USAGE = [
  'lloyal ability:new — scaffold a new HDK ability',
  '',
  'Usage:',
  '  lloyal ability:new <name> [--dir <path>] [--publisher <handle>]',
  '',
  'Arguments:',
  '  <name>              Ability name (lowercase, [a-z][a-z0-9_-]{1,63}) — also the',
  '                      manifest `name` and the directory created for it.',
  '',
  'Options:',
  '  --dir <path>        Parent directory to create the ability in (default: cwd).',
  '  --publisher <h>     Your publisher handle (default: "your-handle"). Used to',
  '                      seed the npm `name` field in package.json. You can edit',
  '                      it later before publishing.',
  '  -h, --help          Show this help.',
  '',
  'Emits a working HDK ability with search + fetch tools that call Wikipedia\'s',
  'public REST (no auth required), so `npm install && npm run build` and a',
  'register-in-harness smoke pass out of the box. Replace the tool bodies with',
  'your real backend; keep the schema + return shape so consumers stay',
  'compatible.',
].join('\n');

// Pattern shared with `lloyal new`: identifier grammar that
// satisfies Ability protocol + npm scoped-name conventions.
const NAME_RE = /^[a-z][a-z0-9_-]{1,63}$/;

export const appCommand: Command = {
  name: 'ability:new',
  summary: 'Scaffold a new HDK ability',
  usage: USAGE,
  async run(argv) {
    const { values, positionals } = parseArgs({
      args: [...argv],
      options: {
        help: { type: 'boolean', short: 'h' },
        dir: { type: 'string' },
        publisher: { type: 'string' },
      },
      allowPositionals: true,
    });

    if (values.help) {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }

    const name = positionals[0];
    if (!name) {
      process.stderr.write('lloyal ability:new: missing <name>\n\n' + USAGE + '\n');
      return 1;
    }
    if (!NAME_RE.test(name)) {
      process.stderr.write(
        `lloyal ability:new: invalid <name> "${name}" — expected [a-z][a-z0-9_-]{1,63}.\n`,
      );
      return 1;
    }

    const parentDir = resolve(values.dir ?? process.cwd());
    const dest = join(parentDir, name);
    const publisher = (values.publisher ?? 'your-handle').replace(/^@/, '');
    if (!NAME_RE.test(publisher)) {
      process.stderr.write(
        `lloyal ability:new: invalid --publisher "${publisher}" — expected [a-z][a-z0-9_-]{1,63}.\n`,
      );
      return 1;
    }

    // Bail rather than overwrite — accidental clobbering is worse than a
    // re-run with a cleared directory.
    try {
      if (statSync(dest).isDirectory()) {
        process.stderr.write(
          `lloyal ability:new: ${dest} already exists. Choose a different name or remove the directory first.\n`,
        );
        return 1;
      }
    } catch {
      // ENOENT — good, that's what we want
    }

    const templateDir = resolveTemplateDir('ability');
    const substitutions = buildSubstitutions(name, publisher);

    try {
      copyTreeWithSubstitutions(templateDir, dest, substitutions);
    } catch (err) {
      process.stderr.write(
        `lloyal ability:new: scaffold failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 1;
    }

    process.stdout.write(
      `scaffolded ${name} at ${dest}\n` +
        '  next steps:\n' +
        `    cd ${name}\n` +
        '    npm install\n' +
        '    npm run build\n' +
        '\n' +
        '  before publishing, edit:\n' +
        '    ability.json        — useWhen describes when an agent should pick your ability\n' +
        '    src/tools/      — replace the Wikipedia stubs with your real backend\n' +
        '    package.json    — confirm the npm name (currently @' + publisher + '/' + name + '-ability)\n',
    );
    return 0;
  },
};

/**
 * Resolve the templates directory by walking up from this module's
 * compiled location. After build, the CLI lives at
 * `<pkg-root>/dist/commands/ability.js`, so the templates are at
 * `<pkg-root>/templates/<kind>`.
 */
function resolveTemplateDir(kind: 'ability'): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '..', '..', 'templates', kind),
    resolve(here, '..', 'templates', kind),
  ];
  for (const c of candidates) {
    try {
      if (statSync(c).isDirectory()) return c;
    } catch {
      // try next
    }
  }
  throw new Error(`templates/${kind} not found relative to ${here}`);
}

/**
 * Build the placeholder → replacement map. Identifiers are derived from
 * the ability name + the publisher handle so the scaffolded code is
 * immediately consistent without any post-rename pass.
 */
function buildSubstitutions(name: string, publisher: string): Record<string, string> {
  return {
    __NAME__: name,
    __NAME_PASCAL__: pascalCase(name),
    __PUBLISHER__: publisher,
  };
}

function pascalCase(s: string): string {
  return s
    .split(/[-_]/g)
    .filter((seg) => seg.length > 0)
    .map((seg) => seg[0].toUpperCase() + seg.slice(1))
    .join('');
}

/**
 * Recursively copy `src` → `dest`, substituting placeholders in every
 * file's contents AND in directory + filename segments. Substitutions
 * are simple string replaces; we never interpret placeholder values as
 * regexes or shell input.
 */
function copyTreeWithSubstitutions(
  src: string,
  dest: string,
  substitutions: Record<string, string>,
): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const fromPath = join(src, entry.name);
    const toName = applySubstitutions(entry.name, substitutions);
    const toPath = join(dest, toName);

    if (entry.isDirectory()) {
      copyTreeWithSubstitutions(fromPath, toPath, substitutions);
      continue;
    }
    if (!entry.isFile()) continue;

    const raw = readFileSync(fromPath, 'utf-8');
    const rendered = applySubstitutions(raw, substitutions);
    mkdirSync(dirname(toPath), { recursive: true });
    writeFileSync(toPath, rendered, 'utf-8');
  }
}

function applySubstitutions(s: string, substitutions: Record<string, string>): string {
  let out = s;
  for (const [token, value] of Object.entries(substitutions)) {
    out = out.split(token).join(value);
  }
  return out;
}
