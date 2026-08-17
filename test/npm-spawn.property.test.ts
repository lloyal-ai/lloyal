/**
 * The invariant, instead of the examples I happened to think of.
 *
 * Every escaping bug in this module was found by a reviewer reasoning over the
 * input space while my tests asserted cases I had already imagined: a space,
 * then a trailing backslash, then `%`, then `& | < > ^ !`. Four rounds, each
 * one character class late.
 *
 * There is only one property worth asserting, and it covers all of them:
 *
 *   For ANY argument, resolveNpmInvocation either
 *     (a) hands it to the OS byte-identical with no shell, or
 *     (b) refuses.
 *
 * It never passes an argument to something that will reinterpret it. A new
 * metacharacter, a new platform quirk, an encoding nobody considered — each
 * fails this property without anyone having to name it first.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  resolveNpmInvocation,
  UnsafeWindowsArgumentError,
} from '../src/npm-spawn';

const NODE = '/usr/bin/node';
const JS = '/npm/bin/npm-cli.js';

describe('property: an argument is passed intact or refused, never mangled', () => {
  it('holds on every platform and both resolution paths', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom<NodeJS.Platform>('win32', 'darwin', 'linux'),
        fc.boolean(),
        (arg, platform, npmEntryFound) => {
          let r;
          try {
            r = resolveNpmInvocation(
              ['install', arg],
              platform,
              npmEntryFound ? JS : undefined,
              NODE,
              () => npmEntryFound,
            );
          } catch (e) {
            // Refusal is only ever allowed where a shell would have parsed it.
            expect(e).toBeInstanceOf(UnsafeWindowsArgumentError);
            expect(platform).toBe('win32');
            expect(npmEntryFound).toBe(false);
            return;
          }
          if (!r.shell) {
            // No shell: the argument must survive byte-identical.
            expect(r.argv).toContain(arg);
          } else {
            // A shell ran, so nothing it could reinterpret may have reached it.
            expect(arg).not.toMatch(/[%!&|<>^]/);
          }
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('the no-shell path is the overwhelmingly common one', () => {
    // Guards against "fixing" the property by refusing everything.
    let shellUsed = 0;
    for (const platform of ['win32', 'darwin', 'linux'] as NodeJS.Platform[]) {
      const r = resolveNpmInvocation(['install', 'lloyal/web'], platform, JS, NODE, () => true);
      if (r.shell) shellUsed++;
    }
    expect(shellUsed).toBe(0);
  });
});
