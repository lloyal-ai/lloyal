#!/usr/bin/env node
/**
 * The end of `harness.dev`. This bin does one thing: say where the CLI went,
 * and fail.
 *
 * It fails rather than forwarding, deliberately. A shim that quietly ran the
 * new CLI would leave people on a retired name indefinitely, and every doc link
 * and error message they saw would name a command that no longer exists.
 *
 * It also exists because `npm deprecate` is not sufficient on its own. The
 * deprecation warning appears on `npm install`, but `npx` runs the bin — and
 * there the warning is easy to miss entirely. Since `npx harness.dev` was the
 * documented way to use this, the bin is what has to carry the message.
 */
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Colour only when someone is watching; piped or captured output stays clean.
const tty = process.stderr.isTTY === true;
const bold = (s) => (tty ? BOLD + s + RESET : s);
const dim = (s) => (tty ? DIM + s + RESET : s);

process.stderr.write(
  [
    '',
    '  ' + bold('harness.dev is now lloyal-ai.'),
    '',
    '      npx lloyal-ai new',
    '',
    '  ' + dim('Installed globally, the command is just `lloyal`:'),
    '      npm i -g lloyal-ai   ->   lloyal new',
    '',
    '  ' + dim('Docs    https://docs.lloyal.ai'),
    '  ' + dim('Source  https://github.com/lloyal-ai/lloyal'),
    '',
    '',
  ].join('\n'),
);

process.exit(1);
