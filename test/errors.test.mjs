import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CommerceInputError,
  FixedPlacementError,
  InvalidRequestError,
  UnsupportedFeatureError,
  fromWasm,
} from '../src/errors.js';

// The two checks against the rest of the workspace -- `@packvium/engine`'s classes and the
// Rust core's source -- run only where those sit beside this package. The published mirror
// ships this package alone, so there they are skipped by name rather than failing.
const ENGINE = new URL('../../node-package/fallback.js', import.meta.url);
const CORE = new URL('../../packvium-rust/crates/packvium-core/src/', import.meta.url);
const engine = existsSync(ENGINE) ? await import(ENGINE.href) : null;
const outsideTheWorkspace = 'needs the workspace beside this package';

/**
 * A refusal from the WebAssembly module reaches a caller as the class
 * `@packvium/engine` throws, not as a bare message. The translation is tested against the
 * `Error` the Rust binding raises; the last tests use the real module when a build is
 * present (`wasm-pack` output is not in this repository).
 */

/** What `bindings/wasm` raises: an `Error` with the core's message and structured properties. */
function raised(message, properties) {
  return Object.assign(new Error(message), properties);
}

test('an invalid request becomes an InvalidRequestError, a RangeError like the engine’s', () => {
  const error = fromWasm(raised('invalid_request: /items/0/quantity: must be at least 1', {
    code: 'invalid_request', reason: 'below_minimum', field: '/items/0/quantity', detail: 'must be at least 1',
  }));
  assert.ok(error instanceof InvalidRequestError && error instanceof RangeError);
  assert.deepEqual(
    { name: error.name, code: error.code, reason: error.reason, field: error.field, message: error.message },
    { name: 'InvalidRequestError', code: 'invalid_request', reason: 'below_minimum',
      field: '/items/0/quantity', message: 'invalid_request: /items/0/quantity: must be at least 1' },
  );
});

test('a fixed-placement refusal keeps its own code and message form', () => {
  const error = fromWasm(raised('invalid_fixed_placement: collision: a#1 with a#2', {
    code: 'invalid_fixed_placement', reason: 'cannot_hold', field: '/fixed_placements',
    detail: 'collision: a#1 with a#2',
  }));
  assert.ok(error instanceof FixedPlacementError && error instanceof InvalidRequestError);
  assert.equal(error.message, 'invalid_fixed_placement: collision: a#1 with a#2');
});

/** The core's sentence for an unsupported field, as `packvium-core` `api.rs` formats it. */
const coreUnsupported = (fields) => `unsupported_feature: the Rust core does not yet implement ${fields.join(', ')}; `
  + 'the request was rejected instead of silently ignoring public fields';

test('an unsupported feature names its fields and keeps the core’s sentence', () => {
  const message = coreUnsupported(['container.axles', 'item.x']);
  const error = fromWasm(raised(message, { code: 'unsupported_feature' }));
  assert.ok(error instanceof UnsupportedFeatureError);
  assert.deepEqual(error.fields, ['container.axles', 'item.x']);
  assert.equal(error.message, message);
  assert.equal(error.code, 'unsupported_feature');
});

/** The name, message, code and own enumerable fields a caller can read off an error. */
const visible = (error) => ({ name: error.name, message: error.message, code: error.code, ...error });

const SAME_ARGUMENTS = [
  ['InvalidRequestError', InvalidRequestError, engine?.InvalidRequestError,
    [['below_minimum', '/items/0/quantity', 'must be at least 1'], ['wrong_type', '', 'must be an object']]],
  ['FixedPlacementError', FixedPlacementError, engine?.FixedPlacementError,
    [['collision: a#1 with a#2'], ['bad entry', 'malformed', '/fixed_placements/0/orientation']]],
  ['UnsupportedFeatureError', UnsupportedFeatureError, engine?.UnsupportedFeatureError,
    [[['container.axles', 'item.x']], [['configuration.seed']]]],
];

for (const [name, Browser, Engine, calls] of SAME_ARGUMENTS) {
  test(`${name} constructs exactly as @packvium/engine's does`, { skip: engine ? false : outsideTheWorkspace }, () => {
    for (const args of calls) {
      const browser = new Browser(...args);
      const engine = new Engine(...args);
      assert.deepEqual(visible(browser), visible(engine));
      assert.deepEqual(Object.keys(browser), Object.keys(engine));
      assert.equal(Object.getPrototypeOf(Browser.prototype).constructor.name,
        Object.getPrototypeOf(Engine.prototype).constructor.name);
    }
  });
}

// The core keeps only a sentence for an unsupported field (`PackError::UnsupportedFeature`
// holds a `String`), so `fromWasm` reads the field list out of it. This pins that sentence to
// the format string in the core's source, which every gate has -- the real-module check below
// needs a wasm-pack build -- so a rewording fails here instead of silently emptying `fields`.
test('the core still words an unsupported feature the way fromWasm reads it', { skip: existsSync(CORE) ? false : outsideTheWorkspace }, () => {
  const core = (file) => readFileSync(new URL(file, CORE), 'utf8');
  // A Rust `\` line continuation drops the newline and the next line's leading whitespace.
  const joined = core('api.rs').replace(/\\\n\s*/g, '');
  assert.ok(
    joined.includes('"the Rust core does not yet implement {}; the request was rejected instead of '
      + 'silently ignoring public fields"'),
    'packvium-core api.rs no longer formats the unsupported-feature sentence fromWasm parses',
  );
  assert.ok(core('error.rs').includes('#[error("unsupported_feature: {0}")]'),
    'packvium-core error.rs no longer prefixes the sentence with `unsupported_feature: `');
});

test('a commerce refusal becomes a CommerceInputError', () => {
  const error = fromWasm(Object.assign(new Error('request.zone: expected text'), { name: 'CommerceInputError' }));
  assert.ok(error instanceof CommerceInputError);
  assert.equal(error.message, 'request.zone: expected text');
});

test('any other core error keeps its message and code', () => {
  const original = raised('solver result failed independent validation: overlap', {
    code: 'solution_failed_validation',
  });
  assert.equal(fromWasm(original), original);
});

const built = new URL('../src/pkg/packvium_wasm_bg.wasm', import.meta.url);

const request = (edit = (r) => r) => edit({
  items: [{ id: 'a', quantity: 1, dimensions: { length: '10', width: '10', height: '10' } }],
  containers: [{ id: 'box', inner_dimensions: { length: '20', width: '10', height: '10' } }],
});

test('the real module throws typed errors', async (t) => {
  if (!existsSync(built)) {
    t.skip('src/pkg/ is produced by wasm-pack and is not in this repository');
    return;
  }
  const browser = await import('../src/node.js');
  await assert.rejects(
    browser.pack(request((r) => { r.items[0].quantity = 0; return r; })),
    (error) => error instanceof browser.InvalidRequestError
      && error.reason === 'below_minimum' && error.field === '/items/0/quantity',
  );
  await assert.rejects(
    browser.pack(request((r) => ({
      ...r, fixed_placements: [{ item_type: 'missing', container_type: 'box', orientation: 'LWH' }],
    }))),
    (error) => error instanceof browser.FixedPlacementError && error.reason === 'cannot_hold',
  );
  await assert.rejects(
    browser.pack(request((r) => { r.containers[0].pallet_overhang_limit = '10'; return r; })),
    (error) => error instanceof browser.UnsupportedFeatureError
      && error.fields.join() === 'container.pallet_overhang_limit'
      && error.message === coreUnsupported(['container.pallet_overhang_limit']),
  );
  await assert.rejects(
    browser.commerce.quote({}, {}),
    (error) => error instanceof browser.CommerceInputError,
  );
  await assert.rejects(
    browser.packJson('{"items": 1}'),
    (error) => error instanceof browser.InvalidRequestError && error.field === '/items',
  );
});
