/**
 * publishing/RELEASE-RULES.md, rule 5, for `@packvium/browser`: no published module loads
 * code through a specifier built at run time. A scanner cannot resolve `import(variable)`
 * by reading the package, so it reports the package as loading arbitrary code -- and it is
 * right to. `@packvium/engine` holds itself to the same rule in `force-fallback.test.mjs`.
 *
 * Every `.js` file the manifest publishes is read, the wasm-pack output under `src/pkg/`
 * included whenever a build is present, so a regenerated loader is held to it too.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACKAGE, 'package.json'), 'utf8'));

/** Every published JavaScript file: each `files` entry, walked when it is a directory. */
function publishedScripts() {
  const found = [];
  const visit = (absolute) => {
    if (fs.statSync(absolute).isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) visit(path.join(absolute, name));
    } else if (/\.(?:m|c)?js$/.test(absolute)) {
      found.push(absolute);
    }
  };
  for (const entry of MANIFEST.files) {
    const absolute = path.join(PACKAGE, entry);
    if (fs.existsSync(absolute)) visit(absolute);
  }
  return found;
}

/** Each `import(` / `require(` call whose argument is not one string literal. */
function dynamicLoads(source) {
  const calls = [...source.matchAll(/\b(import|require)\s*\(\s*([^)]*)\)/g)];
  return calls
    .filter(([, , argument]) => !/^(['"])[^'"`$]+\1$/.test(argument.trim()))
    .map(([call]) => call);
}

test('the check sees the loaders it is meant to hold, and flags a variable specifier', () => {
  const sources = publishedScripts().map((file) => path.relative(PACKAGE, file));
  assert.ok(sources.includes(path.join('src', 'node.js')) && sources.includes(path.join('src', 'index.js')),
    'the published loaders are not among the files read; the check below would pass vacuously');
  assert.deepEqual(dynamicLoads("const m = await import(specifier); require(name);"),
    ['import(specifier)', 'require(name)']);
  assert.deepEqual(dynamicLoads("import('./pkg/packvium_wasm.js'); require(\"node:fs\");"), []);
});

test('no published module loads code through a specifier built at run time', () => {
  for (const file of publishedScripts()) {
    assert.deepEqual(dynamicLoads(fs.readFileSync(file, 'utf8')), [],
      `${path.relative(PACKAGE, file)} loads a module through a non-literal specifier`);
  }
});
