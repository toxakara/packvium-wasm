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
