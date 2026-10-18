/**
 * `npm test`'s runner: every `test/*.test.mjs`, listed here rather than by a glob.
 *
 * A quoted `"test/*.test.mjs"` is handed to Node unexpanded, and Node 16 to 20 do not
 * expand it -- the same break `@packvium/engine` had on its advertised Node floor,
 * and the same fix: list the files, then hand them to `node --test`. Windows never asks a
 * shell to expand an unquoted one either.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const tests = fs.readdirSync(testDirectory)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => path.join(testDirectory, name));

if (tests.length === 0) {
  process.stderr.write(`no test files found in ${testDirectory}\n`);
  process.exit(1);
}

const completed = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });

if (completed.error) throw completed.error;
process.exit(completed.status ?? 1);
