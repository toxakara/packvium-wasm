/**
 * Objectives and constraints: choose what "best" means, and say what may not happen.
 *
 * Run it:
 *
 *     node examples/objectives.mjs
 *
 * Both live in the request, so a browser can ask the same questions a server can.
 * `configuration.objective` decides how two valid packings are ranked; item and container
 * fields decide which packings are valid at all. The score is an array of exact integers
 * compared left to right, and its first entry is always the number of items left out: no
 * objective leaves an item behind to save money.
 */

import { init, pack } from '@packvium/browser';

// In a browser this fetches the `.wasm` file; under Node the package's own `node` entry
// point reads it from disk. See examples/basic.mjs.
await init();

const solve = (configuration, items, containers) => pack({
  units: { length: 'mm' },
  configuration: {
    // Counted work decides where the search stops; the wall clock is only a safety fuse.
    effort_budget: { max_candidates_evaluated: 1000000 },
    time_limit_ms: 60000,
    ...configuration,
  },
  items,
  containers,
});

const box = (id, side, extra = {}) => ({
  id, max_payload: '20 kg', inner_dimensions: { length: side, width: side, height: side }, ...extra,
});
const widgets = [{ id: 'widget', quantity: 8, weight: '500 g',
  dimensions: { length: '100', width: '100', height: '100' } }];

// A snug box that costs more to buy, and a roomy one that costs less but bills more
// dimensional weight at the carrier.
const snug = box('snug', '300', { cost_minor: 500 });
const roomy = box('roomy', '400', { cost_minor: 150 });
const dimensionalWeight = {
  dimensional_weight_divisor: 5000,
  dimensional_weight_length_unit: 'cm',
  dimensional_weight_weight_unit: 'kg',
};

console.log('objective -- the same widgets, two boxes on offer');
for (const [label, configuration] of [
  // Fewest containers, then the tightest fit.
  ['default', {}],
  // The cheapest packaging: `cost_minor` is what the box costs you.
  ['lowest_cost', { objective: 'lowest_cost' }],
  // The lowest carrier-billable weight, the greater of actual and dimensional.
  ['shipping_cost', { objective: 'shipping_cost', ...dimensionalWeight }],
]) {
  const result = await solve(configuration, widgets, [snug, roomy]);
  console.log(`  ${label.padEnd(14)} ${result.containers[0].container_type.padEnd(6)} ` +
    `score ${JSON.stringify(result.score)}`);
}

// Constraints are fields on items and containers. A refusal is an answer, never an error.
console.log('\nconstraints -- what may not happen');
const shelf = [{ id: 'shelf', max_payload: '40 kg', inner_dimensions: { length: '800', width: '400', height: '500' } }];

// A 700 mm pole fits the 500 mm high shelf only lying down; `keep_upright` forbids that.
const pole = { id: 'pole', quantity: 1, weight: '1 kg', keep_upright: true,
  dimensions: { length: '90', width: '90', height: '700' } };
const upright = await solve({}, [pole], shelf);
for (const unpacked of upright.unpacked_items) {
  console.log(`  keep_upright       ${unpacked.item_id}: ${unpacked.reason} (${unpacked.proof.level})`);
}

// Tags refuse each other both ways, so the solver opens a second shelf rather than put
// bleach next to flour.
const bleach = { id: 'bleach', quantity: 2, weight: '2 kg', tags: ['hazmat'], incompatible_tags: ['food'],
  dimensions: { length: '120', width: '120', height: '300' } };
const flour = { id: 'flour', quantity: 3, weight: '1500 g', tags: ['food'],
  dimensions: { length: '200', width: '150', height: '100' } };
const separated = await solve({}, [bleach, flour], shelf);
for (const container of separated.containers) {
  const contents = [...new Set(container.placements.map((placement) => placement.item_type))];
  console.log(`  incompatible_tags  ${container.id}: ${contents.join(', ')}`);
}

// `max_top_load` caps the weight resting on an item: here, one 5 kg sack per crate of eggs.
const eggs = { id: 'egg-crate', quantity: 1, weight: '1 kg', must_be_on_floor: true, max_top_load: '6 kg',
  dimensions: { length: '300', width: '300', height: '200' } };
const sacks = { id: 'rice-sack', quantity: 2, weight: '5 kg',
  dimensions: { length: '300', width: '300', height: '150' } };
const column = [{ id: 'column', inner_dimensions: { length: '310', width: '310', height: '600' } }];
const loaded = await solve({}, [eggs, sacks], column);
for (const container of loaded.containers) {
  const stack = container.placements.map((placement) => placement.item_type);
  console.log(`  max_top_load       ${container.id}: ${stack.join(' under ')}`);
}
