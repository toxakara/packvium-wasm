/**
 * Errors: what a refused request looks like when it comes back across WebAssembly.
 *
 * Run it:
 *
 *     node examples/errors.mjs
 *
 * A request that is wrong -- a missing field, a count of zero, an unknown unit -- is
 * refused before anything is solved. `@packvium/engine` throws an `InvalidRequestError`
 * object for that, with `code`, `reason` and `field` properties. This package cannot:
 * what crosses the WebAssembly boundary is the message, so it throws that message as a
 * plain **string**, not an `Error`.
 *
 * The message is the same one every Packvium engine writes, `<code>: <field>: <detail>`,
 * so the code and the JSON Pointer to the bad value are in it and can be read back out.
 *
 * A request that is valid but does not fit completely is not an error at all: the result
 * lists what was left out in `unpacked_items`, as examples/basic.mjs shows.
 */

import { init, pack, packJson } from '@packvium/browser';

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

/**
 * Split a refusal into its parts. `invalid_request` messages carry a JSON Pointer
 * (`/items/0/quantity`) between the code and the detail; other codes carry only a detail.
 * Anything thrown that is not a string is not a refusal, so it is re-thrown untouched.
 */
const parseRefusal = (thrown) => {
  if (typeof thrown !== 'string') throw thrown;
  const pointer = /^(invalid_request): (\/\S*|): (.*)$/s.exec(thrown);
  if (pointer) return { code: pointer[1], field: pointer[2], detail: pointer[3] };
  const [, code = '', detail = thrown] = /^([a-z_]+): (.*)$/s.exec(thrown) ?? [];
  return { code, field: null, detail };
};

const attempt = async (label, request) => {
  try {
    await pack(request);
    console.log(`${label}: accepted`);
  } catch (thrown) {
    const { code, field, detail } = parseRefusal(thrown);
    console.log(`\n${label}`);
    console.log(`  thrown  ${typeof thrown}: ${thrown}`);
    console.log(`  code    ${code}`);
    if (field !== null) console.log(`  field   ${field}`);
    console.log(`  detail  ${detail}`);
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

// `packJson` takes text, so malformed JSON is refused by the engine's own parser -- also
// as a string, and without an `invalid_request` code.
try {
  await packJson('{"items": [');
} catch (thrown) {
  console.log(`\nmalformed JSON text\n  thrown  ${typeof thrown}: ${thrown}`);
}

// The one thing to remember: `catch (error)` here receives a string, so `error.message`
// is undefined. Test `typeof error === 'string'` before reading it, as parseRefusal does.
