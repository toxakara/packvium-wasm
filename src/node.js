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

export {
  CommerceInputError,
  FixedPlacementError,
  InvalidRequestError,
  MalformedResult,
  UnsupportedFeatureError,
} from './errors.js';

const WASM_URL = new URL('./pkg/packvium_wasm_bg.wasm', import.meta.url);

/**
 * The built module, imported by a *literal* specifier: a specifier held in a variable cannot
 * be resolved by reading the code, and a scanner rightly reports such a package as loading
 * arbitrary code (publishing/RELEASE-RULES.md, rule 5). `test/no-dynamic-import.test.mjs`
 * holds every module under `src/` to that.
 */
const importBuiltModule = () => import('./pkg/packvium_wasm.js');

/**
 * A loader that reads the module's WebAssembly off disk and initializes it with the bytes.
 *
 * Both the bytes' location and the import are parameters so the loader itself can be tested
 * against a stand-in module and a real, minimal `.wasm` -- the actual `pkg/` is produced by
 * `wasm-pack` and is not in this repository, and a test that could only run after a Rust
 * build is a test that does not run. The import is a function, not a specifier, so the
 * stand-in's dynamic import lives in the test rather than in the published module.
 *
 * The returned namespace has `default` removed on purpose: it has already been called, and
 * leaving it in place would have `createApi` initialize the module a second time.
 */
export function createNodeLoader(wasmUrl = WASM_URL, importModule = importBuiltModule) {
  return async () => {
    const module = await importModule();
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

export const { commerce, init, pack, packJson, rebalanceWeight, validate } = createApi(createNodeLoader());
