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

import { init, pack } from '../src/index.js';

/**
 * Node has no `fetch` for `file://` URLs, and the shipped module is built for the web
 * target, so its default initializer cannot find its own `.wasm` there. `init` takes a
 * loader for exactly this: read the bytes off disk and hand them over. Same module, same
 * answers -- only the way the bytes arrive differs.
 */
async function loadFromDisk() {
  const [{ readFile }, module] = await Promise.all([
    import('node:fs/promises'),
    import('../src/pkg/packvium_wasm.js'),
  ]);
  await module.default({
    module_or_path: await readFile(new URL('../src/pkg/packvium_wasm_bg.wasm', import.meta.url)),
  });
  // `init` calls `default()` on whatever the loader returns. It is already initialized,
  // so hide that entry rather than instantiate the module a second time.
  return { ...module, default: null };
}

// In a browser this is just `await init()` -- it fetches the `.wasm` sitting next to the
// module. Calling it up front is optional: the first `pack` would initialize anyway.
// Doing it explicitly keeps instantiation out of your first user interaction.
const inNode = typeof process !== 'undefined' && process.versions?.node != null;
await (inNode ? init(loadFromDisk) : init());

const request = {
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
