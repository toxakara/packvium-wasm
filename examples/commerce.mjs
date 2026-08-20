/**
 * Quote a shipment from the browser, without a server round-trip.
 *
 * Run it:
 *
 *     node examples/commerce.mjs
 *
 * The three commerce functions take the same canonical document as every other Packvium
 * implementation, and `@packvium/engine`'s `examples/commerce.mjs` walks that document
 * field by field. This example is about the one thing that differs here: everything is
 * async, because the WebAssembly module has to be instantiated before the first call.
 *
 * Why it matters that this runs in the browser at all: a quote is an exact integer
 * computed from a tariff you supply, so the number a shopper sees at checkout is the
 * same number your fulfilment system will compute later from the same tariff version.
 * No rate data is embedded and no carrier is contacted -- there is nothing to be out of
 * date with, and nothing to leak.
 */

import { commerce, init } from '../src/index.js';

/** See examples/basic.mjs -- Node cannot `fetch` the web-target module off disk. */
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

// One carrier, one service, one published tariff version. A version's number is its
// 1-based position in this list, so there is no separate numbering to keep in sync.
const document = {
  tariffs: [{
    carrier_id: 'acme',
    service_id: 'ground',
    versions: [{
      effective_at: 0,
      // Volume in mm^3 divided by this gives dimensional weight in grams.
      dimensional_weight_divisor: 5000,
      cost_per_dimensional_kg_minor: { 'zone-a': 450, 'zone-b': 610 },
      minimum_charge_minor: 900,
      fuel_surcharge_permille: 120,
      accessorials: [
        { accessorial_id: 'liftgate', flat_charge_minor: 250 },
        { accessorial_id: 'residential', permille_of_base: 75 },
      ],
    }],
  }],
};

const quote = await commerce.quote(document, {
  carrier_id: 'acme',
  service_id: 'ground',
  zone: 'zone-a',
  volume_mm3: 27_000_000,
  actual_weight_g: 4200,
  requested_accessorials: ['liftgate'],
  as_of: 0,
});

console.log(`status: ${quote.status}`);
console.log(`billed weight: ${quote.quote.billed_weight_g} g ` +
  `(the greater of actual and dimensional)`);
console.log(`base charge:   ${quote.quote.base_charge_minor}`);
console.log(`fuel:          ${quote.quote.fuel_surcharge_minor}`);
console.log(`accessorials:  ${JSON.stringify(quote.quote.accessorial_charges_minor)}`);
console.log(`total:         ${quote.quote.total_minor} minor units`);

// The tariff version that produced the number travels with it. Store this alongside the
// order: it is what lets you re-derive the same price months later, after the tariff has
// been superseded, without keeping a copy of the whole rate card.
console.log(`\npriced by tariff version ${quote.quote.tariff_version}`);
