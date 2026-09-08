/**
 * Shapes: when an item is not its box.
 *
 * Run it:
 *
 *     node examples/shapes.mjs
 *
 * Every other example treats an item as the box it declares. That is the default and it
 * is right for almost everything, because a carton *is* a cuboid. Two kinds of goods are
 * not: a moulded or tapered part that leaves a usable void beside it, and a soft one that
 * gives way under whatever is stacked on it.
 *
 * `shape_type` narrows the box in one direction each -- `convex_hull` in space,
 * `compressible` in height under load -- and neither is ever inferred. An engine that
 * quietly packed a hull as its bounding box would return a plan that validates and does
 * not physically fit, so the value has to be asked for.
 *
 * This package has no JavaScript fallback: the WebAssembly module is the Rust core,
 * compiled. So the numbers below are the Rust engine's own, and the Python and PHP
 * engines print the same ones for the same request.
 */

import { init, pack } from '../src/index.js';

/** Node cannot `fetch` a `file://` URL, so hand the module its bytes off disk. */
async function loadFromDisk() {
  const [{ readFile }, module] = await Promise.all([
    import('node:fs/promises'),
    import('../src/pkg/packvium_wasm.js'),
  ]);
  await module.default({
    module_or_path: await readFile(new URL('../src/pkg/packvium_wasm_bg.wasm', import.meta.url)),
  });
  return { ...module, default: null };
}

const inNode = typeof process !== 'undefined' && process.versions?.node != null;
await (inNode ? init(loadFromDisk) : init());

const MM = { units: { length: 'mm' } };
const crate = (length, width, height) => [
  { id: 'crate', inner_dimensions: { length, width, height } },
];

/** Run one request and print only what the shape changed. */
const summarise = async (label, request) => {
  const result = await pack({ ...MM, ...request });
  const placed = result.containers.reduce((n, c) => n + c.placements.length, 0);
  console.log(
    `  ${label.padEnd(22)} ${result.containers.length} container(s), ${placed} placed, ` +
    `${result.unpacked_items.length} refused, unused volume ${result.score[3]} ppm`,
  );
};

// ------------------------------------------------------------------ convex_hull
//
// Two triangular prisms cut from the same cube along its diagonal. Their bounding boxes
// are identical and each fills the crate on its own, so as cuboids the second has nowhere
// to go. As hulls they are complementary halves and share the crate exactly: collisions
// are decided by an exact integer separating-axis test on the vertices, not by a box
// overlap.
//
// The hull is given in the item's own coordinates, in the request's length unit, and must
// fit inside the declared dimensions. It does not replace them -- the box still bounds the
// item, the hull only says how much of that box is solid.

const LOWER_WEDGE = [
  { x: '0', y: '0', z: '0' }, { x: '100', y: '0', z: '0' },
  { x: '0', y: '100', z: '0' }, { x: '0', y: '0', z: '100' },
  { x: '100', y: '0', z: '100' }, { x: '0', y: '100', z: '100' },
];
const UPPER_WEDGE = [
  { x: '100', y: '100', z: '0' }, { x: '100', y: '0', z: '0' },
  { x: '0', y: '100', z: '0' }, { x: '100', y: '100', z: '100' },
  { x: '100', y: '0', z: '100' }, { x: '0', y: '100', z: '100' },
];

const wedge = (id, vertices) => ({
  id,
  quantity: 1,
  dimensions: { length: '100', width: '100', height: '100' },
  weight: { value: '1', unit: 'kg' },
  ...(vertices ? { shape_type: 'convex_hull', hull_vertices: vertices } : {}),
});

console.log('convex_hull -- two complementary wedges cut from one cube');
await summarise('as cuboids', {
  items: [wedge('wedge-lower', null), wedge('wedge-upper', null)],
  containers: crate('100', '100', '100'),
});
await summarise('as hulls', {
  items: [wedge('wedge-lower', LOWER_WEDGE), wedge('wedge-upper', UPPER_WEDGE)],
  containers: crate('100', '100', '100'),
});

// One crate instead of two, for the same goods and the same crate. Nothing changed except
// the claim that the items are wedges rather than blocks.

// ----------------------------------------------------------------- compressible
//
// `compression_ratio` is the fraction of its own height an item may lose under load, and
// `max_compression_pressure_kpa` is where yielding becomes crushing and the load is
// refused instead. The mass above decides how much it actually gives.
//
// `must_be_on_floor` is not decoration: without it the solver may put the brick
// underneath, nothing bears on the cushion, and the feature never engages.

const cushion = {
  id: 'cushion',
  quantity: 1,
  dimensions: { length: '100', width: '100', height: '100' },
  weight: { value: '2', unit: 'kg' },
  must_be_on_floor: true,
  shape_type: 'compressible',
  compression_ratio: 0.25,
  max_compression_pressure_kpa: 100,
};
const brick = (kilograms) => ({
  id: 'brick',
  quantity: 1,
  dimensions: { length: '100', width: '100', height: '100' },
  weight: { value: String(kilograms), unit: 'kg' },
});

// The crate is 100x100x200 and both items are 100 mm cubes, so rigidly they fill it
// exactly and nothing is unused. Under 101 kg the cushion gives up part of its quarter and
// the volume it stops occupying shows up as unused. One more kilogram crosses 100 kPa over
// its 0.01 m^2 face: the stack is refused and the brick opens a second crate.
console.log('\ncompressible -- a cushion that yields to the load above it');
for (const kilograms of [101, 102]) {
  await summarise(`brick ${kilograms} kg`, {
    items: [cushion, brick(kilograms)],
    containers: crate('100', '100', '200'),
  });
}

// Both shapes are refused rather than approximated wherever the engine cannot honour them
// exactly -- a hull on a route, a hull under a configured clearance, a compressible item
// with `nesting_height`. A wrong answer that validates is worse than a refusal that does
// not, which is why these are opt-in.
