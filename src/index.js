let modulePromise;

async function loadAndInitialize(loader) {
  const module = await loader();
  if (typeof module.default === 'function') {
    await module.default();
  }
  return module;
}

export async function init(loader = () => import('./pkg/packvium_wasm.js')) {
  if (modulePromise == null) {
    modulePromise = loadAndInitialize(loader);
  }
  return modulePromise;
}

export async function pack(request) {
  const wasm = await init();
  return JSON.parse(wasm.pack_json(JSON.stringify(request)));
}

export async function packJson(request) {
  const wasm = await init();
  return wasm.pack_json(request);
}

/**
 * The exported commercial and control-plane API: a quote, a policy decision and catalog
 * version metadata over one canonical JSON document (docs/COMMERCE-API.md).
 *
 * The browser build has no JavaScript fallback to select between -- the WebAssembly
 * module *is* the engine here -- so these forward straight to it, and a caller gets the
 * same canonical result document `@packvium/engine` returns for the same input.
 */
export const commerce = {
  quote: (document, request) => call('commerce_quote_json', document, request),
  evaluatePolicy: (document, request) => call('commerce_evaluate_policy_json', document, request),
  catalogVersionInfo: (document, request) =>
    call('commerce_catalog_version_info_json', document, request),
};

async function call(entry, document, request) {
  const wasm = await init();
  return JSON.parse(wasm[entry](JSON.stringify({ document, request })));
}
