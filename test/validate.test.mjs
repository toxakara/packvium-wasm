import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { createApi } from '../src/api.js';
import { MalformedResult } from '../src/errors.js';

/**
 * `validate(request, result)` is the reference validator, compiled into the module.
 * The module returns one document, `{issues}` or `{refusal: {kind, message}}`, and the package
 * raises a refusal as the `MalformedResult` `@packvium/engine` throws. Issue-for-issue
 * agreement with `packvium.validate` is `conformance/result_validation/run.py`'s job.
 */

const built = new URL('../src/pkg/packvium_wasm_bg.wasm', import.meta.url);

const REQUEST = {
  items: [{ id: 'cube', quantity: 2, dimensions: { length: '10', width: '10', height: '10' } }],
  containers: [{ id: 'box', inner_dimensions: { length: '20', width: '10', height: '10' } }],
};

/** A module that answers every `validate_json` with `outcome`. */
const answering = (outcome) => createApi(async () => ({
  pack_json: () => '{}',
  validate_json: () => JSON.stringify(outcome),
}));

test('the module\'s issues are returned as they came', async () => {
  const issues = [{ code: 'collision', detail: 'cube#1 with cube#2 in box#1' }];
  assert.deepEqual(await answering({ issues }).validate(REQUEST, {}), issues);
});

test('a refusal becomes a MalformedResult carrying its kind', async () => {
  const api = answering({ refusal: { kind: 'shape', message: 'missing "item_id"' } });
  await assert.rejects(api.validate(REQUEST, {}), (error) => error instanceof MalformedResult
    && error.kind === 'shape' && error.message === 'missing "item_id"');
});

test('the real module judges a packed result valid and a broken one not', async (t) => {
  if (!existsSync(built)) {
    t.skip('src/pkg/ is produced by wasm-pack and is not in this repository');
    return;
  }
  const browser = await import('../src/node.js');
  const result = await browser.pack(REQUEST);
  assert.deepEqual(await browser.validate(REQUEST, result), []);
  const broken = structuredClone(result);
  broken.containers[0].placements[1].position = structuredClone(broken.containers[0].placements[0].position);
  assert.deepEqual(await browser.validate(REQUEST, broken), [
    { code: 'collision', detail: 'cube#1 with cube#2 in box#1' },
  ]);
  await assert.rejects(browser.validate(REQUEST, { containers: 'none' }), (error) =>
    error instanceof browser.MalformedResult && error.kind === 'contract'
      && error.message === "result is missing 'status'");
});
