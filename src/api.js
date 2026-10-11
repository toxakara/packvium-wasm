/**
 * The engine surface, bound to whichever loader the environment supplies.
 *
 * There is one implementation and two bindings: `index.js` for a browser, where the
 * WebAssembly module fetches itself over HTTP, and `node.js`, where it cannot -- a
 * `file:` URL is not something Node's `fetch` will read, so the bytes have to come off
 * disk. Splitting the two through `package.json`'s `exports` conditions rather than an
 * `if` in here is deliberate: a browser bundle never parses the Node binding at all, so
 * no bundler ever has to be told what to do with `node:fs`.
 */

const MAX_U32 = 0xffffffff;

export function createApi(defaultLoader) {
  let modulePromise;

  async function loadAndInitialize(loader) {
    const module = await loader();
    if (typeof module.default === 'function') {
      await module.default();
    }
    return module;
  }

  async function init(loader = defaultLoader) {
    if (modulePromise == null) {
      modulePromise = loadAndInitialize(loader);
    }
    return modulePromise;
  }

  async function pack(request) {
    const wasm = await init();
    return JSON.parse(wasm.pack_json(JSON.stringify(request)));
  }

  async function packJson(request) {
    const wasm = await init();
    return wasm.pack_json(request);
  }

  async function call(entry, document, request) {
    const wasm = await init();
    return JSON.parse(wasm[entry](JSON.stringify({ document, request })));
  }

  /**
   * The exported commercial and control-plane API: a quote, a policy decision and catalog
   * version metadata over one canonical JSON document (docs/COMMERCE-API.md).
   *
   * The browser build has no JavaScript fallback to select between -- the WebAssembly
   * module *is* the engine here -- so these forward straight to it, and a caller gets the
   * same canonical result document `@packvium/engine` returns for the same input.
   */
  const commerce = {
    quote: (document, request) => call('commerce_quote_json', document, request),
    evaluatePolicy: (document, request) => call('commerce_evaluate_policy_json', document, request),
    catalogVersionInfo: (document, request) =>
      call('commerce_catalog_version_info_json', document, request),
  };

  /**
   * Weight rebalancing over an existing result, the WebAssembly module's `rebalance_json`
   * (docs/PUBLIC-API.md). Same name, arguments and answer as `@packvium/engine`'s
   * `rebalanceWeight`, so the call moves between the two packages unchanged.
   *
   * `maxMoves` is checked here because the module takes a `u32` and wasm-bindgen wraps
   * anything else into range: `-1` would arrive as four billion moves, not as an error.
   */
  async function rebalanceWeight(request, result, { maxMoves = 64 } = {}) {
    if (!Number.isSafeInteger(maxMoves) || maxMoves < 0 || maxMoves > MAX_U32) {
      throw new RangeError('maxMoves must be an integer from 0 to 4294967295');
    }
    const wasm = await init();
    return JSON.parse(
      wasm.rebalance_json(JSON.stringify(request), JSON.stringify(result), maxMoves),
    );
  }

  return { init, pack, packJson, rebalanceWeight, commerce };
}
