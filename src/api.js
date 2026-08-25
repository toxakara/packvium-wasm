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

  return { init, pack, packJson, commerce };
}
