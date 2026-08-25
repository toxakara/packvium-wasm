import assert from 'node:assert/strict';
import test from 'node:test';

import { commerce, init, pack } from '../src/node.js';

/**
 * . The first version of this file shimmed `globalThis.fetch` to give Node `file:`
 * URL support and then loaded the browser entry point through it — which is to say it
 * patched the exact thing that was broken, and the package shipped to npm unable to
 * initialize under Node at all.
 *
 * There is no shim here now, and no browser case either. The generated module short-
 * circuits on `if (wasm !== undefined) return wasm`, so a second initialization in the
 * same process is a no-op: a shimmed "browser" case running after this one would pass
 * without the shim ever being reached, which is precisely the kind of test that let 
 * through. The browser path is verified in a browser, over HTTP, where its `fetch` is the
 * real thing.
 */

test('the shipped Node entry point initializes and packs without any fetch at all', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error(
      'the Node entry point must read its WebAssembly off disk; reaching for fetch is ',
    );
  };

  try {
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

    const quote = await commerce.quote({
      tariffs: [{
        carrier_id: 'acme',
        service_id: 'ground',
        versions: [{
          effective_at: 0,
          dimensional_weight_divisor: 5000,
          cost_per_dimensional_kg_minor: { 'zone-a': 450 },
          minimum_charge_minor: 900,
          fuel_surcharge_permille: 120,
          accessorials: [],
        }],
      }],
    }, {
      carrier_id: 'acme',
      service_id: 'ground',
      tariff_version: 1,
      zone: 'zone-a',
      actual_weight_g: 1200,
      volume_mm3: 6000000,
    });
    assert.equal(quote.status, 'ok');
    assert.equal(quote.quote.total_minor, 1008);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
