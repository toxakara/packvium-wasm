# @packvium/browser

Packvium's deterministic packing engine for browsers and other WebAssembly runtimes.
The package contains the compiled engine; consumers do not need Rust or a separate
download.

```js
import { commerce, pack } from '@packvium/browser';

const result = await pack(request);

const commerceDocument = { tariffs: [{
  carrier_id: 'acme', service_id: 'ground',
  versions: [{
    effective_at: 0, dimensional_weight_divisor: 5000,
    cost_per_dimensional_kg_minor: { 'zone-a': 450 },
    minimum_charge_minor: 900, fuel_surcharge_permille: 120,
  }],
}] };
const quote = await commerce.quote(commerceDocument, {
  carrier_id: 'acme', service_id: 'ground', tariff_version: 1,
  zone: 'zone-a', actual_weight_g: 1200, volume_mm3: 6000000,
});
```

`init()` loads and initializes the module once. `pack()` accepts an object and returns
an object, while `packJson()` is the allocation-conscious JSON-string interface. A
custom loader may be passed to `init()` for a bundler or test environment.
`commerce.quote()`, `commerce.evaluatePolicy()` and `commerce.catalogVersionInfo()`
provide the same deterministic commercial/control-plane API as the other packages;
see `docs/COMMERCE-API.md`.

## Examples

Runnable, in [`examples/`](examples). Each one is a single file you can read top to bottom
and execute without a project around it.

| File | What it shows |
| --- | --- |
| [`basic.mjs`](examples/basic.mjs) | Initialize the module, pack an order, read placements, and see why an item was refused. |
| [`commerce.mjs`](examples/commerce.mjs) | Quote a shipment in the browser with no server round-trip. |

```bash
node examples/basic.mjs
```

Both run in Node as well as a browser. Node cannot `fetch` the web-target module off
disk, so they pass `init()` a loader that reads the bytes instead — the examples show
exactly how, because it is the first thing that surprises people.

## Requirements

- a browser or bundler runtime with WebAssembly and dynamic `import()` support;
- a custom `init()` loader in runtimes that cannot fetch a package-relative WASM URL.

The release tarball is assembled and tested together with the canonical Rust source.
Its repository CI then tests the exact committed module, and tagged releases publish
only after the package version and generated files have been verified.
