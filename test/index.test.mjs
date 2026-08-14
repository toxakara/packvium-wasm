import assert from 'node:assert/strict';
import test from 'node:test';

import { init, pack, packJson } from '../src/index.js';

// The real `pkg/packvium_wasm.js` is produced by `wasm-pack build` from a Rust
// workspace this repository does not carry (see README's "Building" section), so this
// exercises the loader contract with a stand-in instead of the actual WASM module.
//
// `init()` caches its result at module scope for the life of the process, so every
// case below shares one loaded (fake) module -- this is one test, not three, on
// purpose: splitting it would make the outcome depend on execution order.
test('init() loads once and caches; pack()/packJson() route through it', async () => {
  let calls = 0;
  let initializations = 0;
  const loader = () => {
    calls += 1;
    return Promise.resolve({
      default: async () => {
        initializations += 1;
      },
      pack_json: (json) => {
        const request = JSON.parse(json);
        return JSON.stringify({ status: 'feasible', echoed_item_count: request.items.length });
      },
    });
  };

  const first = await init(loader);
  const second = await init(loader);
  assert.equal(calls, 1, 'the loader must not run again once a module is cached');
  assert.equal(initializations, 1, 'a wasm-bindgen module must be initialized once');
  assert.equal(first, second);

  const result = await pack({ items: [{ id: 'a' }, { id: 'b' }] });
  assert.equal(result.status, 'feasible');
  assert.equal(result.echoed_item_count, 2);

  const jsonResult = await packJson(JSON.stringify({ items: [{ id: 'a' }] }));
  assert.equal(typeof jsonResult, 'string');
  assert.deepEqual(JSON.parse(jsonResult), { status: 'feasible', echoed_item_count: 1 });
});
