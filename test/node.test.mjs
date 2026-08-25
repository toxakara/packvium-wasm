import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { createApi } from '../src/api.js';
import { createNodeLoader } from '../src/node.js';

/**
 * The regression these cover, precisely: `wasm-pack --target web` ends its initializer
 * with `fetch(new URL('packvium_wasm_bg.wasm', import.meta.url))`. Under Node that URL is
 * `file:`, undici refuses the scheme, and every call fails at initialization with a
 * `TypeError: fetch failed` that says nothing about the cause. The published
 * `@packvium/browser` 0.1.1 does this, and nothing caught it because no release step ever
 * installed the package and ran it.
 *
 * The real `pkg/` comes out of `wasm-pack` and is not in this repository, so these run
 * against a stand-in module and a genuine -- if empty -- WebAssembly binary. The last test
 * uses the real module when a build happens to be present.
 */

/** The eight bytes of a valid, empty WebAssembly module: magic number and version. */
const EMPTY_MODULE = Uint8Array.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

const STAND_IN = `
export const received = [];
export default async function init(options) {
  received.push(options);
  // Instantiate for real, so bytes handed over in a way WebAssembly cannot read fail here
  // rather than in a browser bundle.
  await WebAssembly.instantiate(options.module_or_path, {});
}
export function pack_json(request) {
  return JSON.stringify({ status: 'feasible', echoed_item_count: JSON.parse(request).items.length });
}
`;

async function standInModule() {
  const directory = await mkdtemp(join(tmpdir(), 'packvium-wasm-'));
  const wasmPath = join(directory, 'packvium_wasm_bg.wasm');
  const modulePath = join(directory, 'packvium_wasm.js');
  await writeFile(wasmPath, EMPTY_MODULE);
  await writeFile(modulePath, STAND_IN);
  return {
    wasmUrl: pathToFileURL(wasmPath),
    moduleSpecifier: pathToFileURL(modulePath).href,
  };
}

/** Break `fetch` for the duration, so "it did not reach the network" is observed. */
async function withoutFetch(body) {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('the Node loader must never fetch; it reads the module off disk');
  };
  try {
    return await body();
  } finally {
    globalThis.fetch = original;
  }
}

test('the Node loader hands the module its bytes instead of fetching a file: URL', async () => {
  const { wasmUrl, moduleSpecifier } = await standInModule();
  const loaded = await withoutFetch(() => createNodeLoader(wasmUrl, moduleSpecifier)());

  const module = await import(moduleSpecifier);
  assert.equal(module.received.length, 1, 'the module must be initialized exactly once');

  const [options] = module.received;
  assert.ok(
    options && typeof options === 'object' && 'module_or_path' in options,
    'wasm-bindgen takes { module_or_path }; a bare positional argument logs a deprecation',
  );
  assert.deepEqual(
    Uint8Array.from(options.module_or_path),
    EMPTY_MODULE,
    'the bytes handed over must be the file on disk',
  );

  // `default` is removed on purpose: it has already run, and leaving it in place would
  // have `createApi` initialize the module a second time.
  assert.equal(loaded.default, undefined);
  assert.equal(typeof loaded.pack_json, 'function');
});

test('the api bound to the Node loader answers without touching the network', async () => {
  const { wasmUrl, moduleSpecifier } = await standInModule();
  const api = createApi(createNodeLoader(wasmUrl, moduleSpecifier));

  const result = await withoutFetch(() => api.pack({ items: [{ id: 'a' }, { id: 'b' }] }));
  assert.equal(result.status, 'feasible');
  assert.equal(result.echoed_item_count, 2);

  const module = await import(moduleSpecifier);
  assert.equal(module.received.length, 1, 'a second call must reuse the cached module');
});

test('the real module loads under Node when a wasm-pack build is present', async (t) => {
  const built = new URL('../src/pkg/packvium_wasm.js', import.meta.url);
  if (!existsSync(built)) {
    t.skip('src/pkg/ is produced by wasm-pack and is not in this repository');
    return;
  }
  const { pack } = await import('../src/node.js');
  const result = await withoutFetch(() => pack({
    items: [{
      id: 'a', dimensions: { length: '100', width: '100', height: '100' },
      weight: '1000', quantity: 1,
    }],
    containers: [{
      id: 'box', inner_dimensions: { length: '400', width: '400', height: '400' },
      max_weight: '30000',
    }],
  }));
  assert.equal(result.status, 'feasible');
});
