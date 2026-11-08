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

import { init, pack } from '@packvium/browser';

// In a browser this fetches the `.wasm` file; under Node the package's own `node` entry
// point reads it from disk. See examples/basic.mjs.
await init();

const MM = {
  units: { length: 'mm' },
  // Counted work decides where the search stops; the wall clock is only a safety fuse.
  configuration: { effort_budget: { max_candidates_evaluated: 1000000 }, time_limit_ms: 60000 },
};
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

// A hull turns 24 ways, not 6. Two copies of the *same* wedge also fill the cube, but only
// if one is turned half a turn about the vertical: that rotation is not one of the six axis
// permutations a box needs, so it has a signed code, `-L-W+H`. The 18 signed codes are
// accepted only on a `convex_hull` item; on a box they would change nothing.
console.log('\nconvex_hull -- two copies of one wedge, turned to fit');
const twins = (rotations) => ({
  items: [{ ...wedge('wedge', LOWER_WEDGE), quantity: 2, allowed_rotations: rotations }],
  containers: crate('100', '100', '100'),
});
await summarise('six box rotations', twins(['LWH', 'WLH', 'WHL', 'HWL', 'HLW', 'LHW']));
await summarise('with -L-W+H', twins(['LWH', '-L-W+H']));

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

// ---------------------------------------------------------------- gusseted bag
//
// A poly mailer is not a box either: it is a flat bag whose walls give, so it is described
// by `deformable_boundary` on the container, not by the items. A flat bag admits a load
// when, across the bag, its width plus its height fits the flat width (`b + c <= W`); a
// gusseted bag folds out `side_gusset_depth` more at each side (`b + c <= W + G`). Four
// 20 mm books, upright as they come, into a 300 x 150 bag: flat, two go in; with a 25 mm
// gusset, three.
console.log('\ngusseted bag -- the same mailer with and without side gussets');
const mailer = (boundary) => ({
  items: [{ id: 'book', quantity: 4, weight: '300 g', allowed_rotations: ['LWH'],
    dimensions: { length: '200', width: '100', height: '20' } }],
  containers: [{ id: 'mailer', quantity: 1, deformable_boundary: boundary,
    inner_dimensions: { length: '300', width: '150', height: '100' } }],
});
await summarise('flat bag', mailer({ kind: 'flat_bag' }));
await summarise('gusseted, 25 mm', mailer({ kind: 'gusseted_bag', side_gusset_depth: '25' }));

// Both shapes are refused rather than approximated wherever the engine cannot honour them
// exactly -- a hull on a route, a hull under a configured clearance, a compressible item
// with `nesting_height`. A wrong answer that validates is worse than a refusal that does
// not, which is why these are opt-in.
