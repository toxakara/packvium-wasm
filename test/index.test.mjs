import assert from 'node:assert/strict';
import test from 'node:test';

import { createApi } from '../src/api.js';
import { commerce, init, pack, packJson, rebalanceWeight } from '../src/index.js';

// The real `pkg/packvium_wasm.js` is produced by `wasm-pack build` from a Rust
// workspace this repository does not carry (see README's "Building" section), so this
// exercises the loader contract with a stand-in instead of the actual WASM module.
//
// `init()` caches its result at module scope for the life of the process, so every
// case below shares one loaded (fake) module -- this is one test, not several, on
// purpose: splitting it would make the outcome depend on execution order.
test('init() loads once and caches; every export routes through it', async () => {
  let calls = 0;
  let initializations = 0;
  // What each commerce entry was handed, so a specifier swapped between two entries
  // fails here rather than in a published browser bundle.
  const seen = {};
  const commerceEntry = (name) => (json) => {
    const call = JSON.parse(json);
    seen[name] = call;
    if (call.request?.returnMalformedJson === true) {
      return '{ this is not JSON';
    }
    return JSON.stringify({ entry: name, echoed: call });
  };
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
      commerce_quote_json: commerceEntry('commerce_quote_json'),
      commerce_evaluate_policy_json: commerceEntry('commerce_evaluate_policy_json'),
      commerce_catalog_version_info_json: commerceEntry('commerce_catalog_version_info_json'),
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

  // Each of the three functions must reach its own WASM export, and each must hand it
  // one `{document, request}` envelope -- not two arguments and not a flattened object.
  const document = { tariffs: [] };
  for (const [method, entry] of [
    ['quote', 'commerce_quote_json'],
    ['evaluatePolicy', 'commerce_evaluate_policy_json'],
    ['catalogVersionInfo', 'commerce_catalog_version_info_json'],
  ]) {
    const request = { marker: method };
    const answer = await commerce[method](document, request);

    assert.equal(answer.entry, entry, `${method}() must call ${entry}`);
    assert.deepEqual(seen[entry], { document, request });
    assert.deepEqual(answer.echoed, { document, request });
  }

  // `JSON.stringify` drops undefined-valued keys, so an omitted argument reaches the
  // module as an absent field rather than as `null`. Pinned because the engine's
  // document parser treats those two differently.
  await commerce.quote(undefined, { marker: 'no document' });
  assert.deepEqual(seen.commerce_quote_json, { request: { marker: 'no document' } });

  // A module that answers with something that is not JSON must fail loudly. Returning
  // `undefined` to the caller would look like a successful empty result.
  await assert.rejects(
    () => commerce.evaluatePolicy(document, { returnMalformedJson: true }),
    SyntaxError,
  );
});

// A fresh `createApi` instance rather than the cached module above, so this case does not
// depend on which test ran first.
test('rebalanceWeight() hands rebalance_json both documents and a checked move count', async () => {
  const seen = [];
  const api = createApi(() =>
    Promise.resolve({
      rebalance_json: (request, result, maxMoves) => {
        seen.push([JSON.parse(request), JSON.parse(result), maxMoves]);
        return JSON.stringify({ containers: [], moves: [], improved: false });
      },
    }),
  );
  const request = { items: [{ id: 'a' }] };
  const result = { containers: [{ id: 'c' }] };

  assert.deepEqual(await api.rebalanceWeight(request, result), {
    containers: [],
    moves: [],
    improved: false,
  });
  await api.rebalanceWeight(request, result, { maxMoves: 0 });
  assert.deepEqual(seen, [
    [request, result, 64],
    [request, result, 0],
  ]);

  // wasm-bindgen would wrap each of these into a u32 instead of refusing it.
  for (const maxMoves of [-1, 1.5, 2 ** 32, Number.NaN, '3']) {
    await assert.rejects(() => api.rebalanceWeight(request, result, { maxMoves }), RangeError);
  }
  assert.equal(seen.length, 2, 'a refused move count must not reach the module');
  assert.equal(typeof rebalanceWeight, 'function', 'the browser entry exports it');
});

test('a failed init() is not cached: the next call loads again and can succeed', async () => {
  let attempts = 0;
  const api = createApi(async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError('Failed to fetch packvium_wasm_bg.wasm');
    return { pack_json: () => JSON.stringify({ status: 'feasible' }) };
  });

  // Two callers waiting on the same failed load are both refused, by the one load.
  const first = await Promise.allSettled([api.pack({}), api.pack({})]);
  assert.deepEqual(first.map((outcome) => outcome.status), ['rejected', 'rejected']);
  assert.equal(attempts, 1);

  assert.deepEqual(await api.pack({}), { status: 'feasible' });
  assert.equal(attempts, 2, 'the retry must start a new load rather than replay the failure');
  await api.pack({});
  assert.equal(attempts, 2, 'a successful load is still cached');
});
