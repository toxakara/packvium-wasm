/**
 * Node entry point, selected by the `node` condition in `package.json`'s `exports`.
 *
 * `wasm-pack --target web` emits a loader that ends with
 * `fetch(new URL('packvium_wasm_bg.wasm', import.meta.url))`. Under Node that URL has the
 * `file:` scheme, which `fetch` refuses -- "not implemented... yet..." out of undici -- so
 * every call fails at initialization with a `TypeError` that says nothing about the real
 * problem. Server-side rendering, a Vitest run in the node environment and `node --test`
 * all land there.
 *
 * The fix is to hand the module its bytes instead of letting it go looking: wasm-bindgen's
 * initializer takes `{ module_or_path }` and instantiates a `BufferSource` directly.
 */

import { readFile } from 'node:fs/promises';

import { createApi } from './api.js';

const WASM_URL = new URL('./pkg/packvium_wasm_bg.wasm', import.meta.url);
const MODULE_SPECIFIER = './pkg/packvium_wasm.js';

/**
 * A loader that reads the module's WebAssembly off disk and initializes it with the bytes.
 *
 * Both locations are parameters so the loader itself can be tested against a stand-in
 * module and a real, minimal `.wasm` -- the actual `pkg/` is produced by `wasm-pack` and
 * is not in this repository, and a test that could only run after a Rust build is a test
 * that does not run.
 *
 * The returned namespace has `default` removed on purpose: it has already been called, and
 * leaving it in place would have `createApi` initialize the module a second time.
 */
export function createNodeLoader(wasmUrl = WASM_URL, moduleSpecifier = MODULE_SPECIFIER) {
  return async () => {
    const module = await import(moduleSpecifier);
    await module.default({ module_or_path: await readFile(wasmUrl) });
    const initialized = {};
    for (const key of Object.keys(module)) {
      if (key !== 'default') {
        initialized[key] = module[key];
      }
    }
    return initialized;
  };
}

export const { commerce, init, pack, packJson } = createApi(createNodeLoader());
