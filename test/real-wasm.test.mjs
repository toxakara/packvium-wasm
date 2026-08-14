import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { init, pack } from '../src/index.js';

test('the shipped WASM engine initializes and packs a request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = input instanceof URL ? input : new URL(input);
    if (url.protocol !== 'file:') {
      return originalFetch(input, options);
    }
    return new Response(await readFile(url), {
      headers: { 'content-type': 'application/wasm' },
    });
  };

  try {
    // `pack()` intentionally uses the package's default loader. The fetch shim only
    // supplies Node with the file-URL support a browser has natively; it does not
    // replace the generated module or its initialization path.
    const result = await pack({
      units: { length: 'mm' },
      containers: [{
        id: 'box',
        inner_dimensions: { length: '10', width: '10', height: '10' },
      }],
      items: [{
        id: 'item',
        quantity: 1,
        dimensions: { length: '2', width: '3', height: '4' },
        weight: '5',
      }],
      configuration: { solver_profile: 'fast', seed: 7 },
    });

    const module = await init();
    assert.match(module.version(), /^\d+\.\d+\.\d+/);
    assert.equal(result.summary.packed_item_count, 1);
    assert.deepEqual(result.unpacked_items, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
