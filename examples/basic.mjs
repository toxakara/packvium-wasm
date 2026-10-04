/**
 * Pack an order in the browser, or in Node, from the same WebAssembly module.
 *
 * Run it:
 *
 *     node examples/basic.mjs
 *
 * Everything here is `await`ed, and that is the only real difference from
 * `@packvium/engine`. The WebAssembly module has to be fetched and instantiated before
 * the first call, so every entry point is async. `init()` does that once and caches it,
 * so calling `pack` in a loop does not re-instantiate anything.
 *
 * There is no JavaScript fallback in this package. The WebAssembly module *is* the
 * engine, which is why the answers here are identical to the Rust core's rather than
 * merely equivalent to them.
 */

import { init, pack } from '@packvium/browser';

// Calling `init()` up front is optional: the first `pack` would initialize anyway. Doing
// it explicitly keeps instantiation out of your first user interaction. In a browser it
// fetches the `.wasm` file next to the module; under Node the package's `node` entry
// point reads the same bytes from disk instead, because Node's `fetch` cannot open a
// `file:` URL. Same module, same answers -- only the way the bytes arrive differs.
await init();

const request = {
  units: { length: 'mm' },
  configuration: {
    // Counted work decides where the search stops, so the answer is the same on any
    // machine; the wall-clock limit is only a safety fuse far above what this needs.
    effort_budget: { max_candidates_evaluated: 1000000 },
    time_limit_ms: 60000,
  },
  items: [
    // Lengths and weights are strings on purpose. They are parsed into exact integers,
    // so '0.1' means a tenth of a millimetre and never 0.09999999999999999. Plain
    // integers and fractions like '3/16' work too.
    { id: 'mug', quantity: 6, dimensions: { length: '120', width: '120', height: '100' }, weight: '400 g' },
    { id: 'plate', quantity: 8, dimensions: { length: '260', width: '260', height: '20' }, weight: '600 g' },
    // Too long for the box in every orientation, so it cannot be placed.
    { id: 'ladder', quantity: 1, dimensions: { length: '1800', width: '300', height: '100' }, weight: '6 kg' },
  ],
  containers: [
    {
      id: 'box',
      inner_dimensions: { length: '400', width: '400', height: '400' },
      max_payload: '15 kg',
      cost_minor: 180,
    },
  ],
};

const result = await pack(request);

console.log(`status: ${result.status}`);
console.log(`containers opened: ${result.containers.length}`);

for (const [index, container] of result.containers.entries()) {
  console.log(`\nbox #${index + 1}: ${container.placements.length} placement(s), ` +
    `${container.volume_utilization} of the volume used`);
  for (const placement of container.placements) {
    // Every measurement arrives as { ticks, value, unit }: `ticks` is the exact integer
    // the engine reasoned about, `value` is that same number written for a human.
    const { x, y, z } = placement.position;
    console.log(
      `  ${placement.item_type.padEnd(8)} at (${x.value}, ${y.value}, ${z.value}) ${x.unit}` +
      `  orientation ${placement.orientation}`,
    );
  }
}

// A refusal is an answer, not an error.
if (result.unpacked_items.length > 0) {
  console.log('\nnot packed:');
  for (const unpacked of result.unpacked_items) {
    console.log(`  ${unpacked.item_id.padEnd(10)} ${unpacked.reason}`);
  }
}
