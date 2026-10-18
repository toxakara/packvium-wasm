/**
 * Errors: what a refused request looks like when it comes back across WebAssembly.
 *
 * Run it:
 *
 *     node examples/errors.mjs
 *
 * A request that is wrong -- a missing field, a count of zero, an unknown unit -- is
 * refused before anything is solved, with the same error classes `@packvium/engine` throws:
 * an `InvalidRequestError` (a `RangeError`) with `code`, `reason`, `field` and `detail`, its
 * subclass `FixedPlacementError` for fixed placements, and `UnsupportedFeatureError`, which
 * lists the `fields` this engine does not implement yet. Branch on `reason` and `field`;
 * nothing needs to be parsed out of the message.
 *
 * A request that is valid but does not fit completely is not an error at all: the result
 * lists what was left out in `unpacked_items`, as examples/basic.mjs shows.
 */

import {
  InvalidRequestError, UnsupportedFeatureError, init, pack, packJson,
} from '@packvium/browser';

// In a browser this fetches the `.wasm` file; under Node the package's own `node` entry
// point reads it from disk. See examples/basic.mjs.
await init();

const valid = () => ({
  units: { length: 'mm' },
  configuration: {
    // Counted work decides where the search stops; the wall clock is only a safety fuse.
    effort_budget: { max_candidates_evaluated: 1000000 },
    time_limit_ms: 60000,
  },
  items: [
    { id: 'mug', quantity: 2, weight: '400 g', dimensions: { length: '120', width: '120', height: '100' } },
  ],
  containers: [
    { id: 'box', inner_dimensions: { length: '400', width: '400', height: '400' } },
  ],
});

const attempt = async (label, request) => {
  try {
    await pack(request);
    console.log(`${label}: accepted`);
  } catch (error) {
    if (!(error instanceof InvalidRequestError) && !(error instanceof UnsupportedFeatureError)) throw error;
    console.log(`\n${label}`);
    console.log(`  thrown  ${error.name}`);
    console.log(`  code    ${error.code}`);
    if (error instanceof InvalidRequestError) {
      console.log(`  reason  ${error.reason}`);
      console.log(`  field   ${error.field}`);
      console.log(`  detail  ${error.detail}`);
    } else {
      console.log(`  fields  ${error.fields.join(', ')}`);
    }
  }
};

const zero = valid();
zero.items[0].quantity = 0;
await attempt('quantity of zero', zero);

const furlong = valid();
furlong.units.length = 'furlong';
await attempt('an unknown unit', furlong);

const missing = valid();
delete missing.items[0].dimensions.height;
await attempt('a missing dimension', missing);

// A fixed placement outside its container, and a field no engine implements yet: both
// refused, each with its own code.
const outside = valid();
outside.fixed_placements = [{ item_type: 'mug', container_type: 'box',
  position: { x: '900', y: '0', z: '0' }, orientation: 'LWH' }];
await attempt('a fixed placement outside the box', outside);

const ahead = valid();
ahead.containers[0].pallet_overhang_limit = { length: '50', width: '50' };
await attempt('a reserved, unimplemented field', ahead);

// `packJson` takes text, so malformed JSON is refused by the engine's own parser: an `Error`
// with the core's `invalid_input` code rather than one of the request-error classes.
try {
  await packJson('{"items": [');
} catch (error) {
  console.log(`\nmalformed JSON text\n  thrown  ${error.name}: ${error.message}\n  code    ${error.code}`);
}
