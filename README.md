# @packvium/browser

Packvium's deterministic packing engine for browsers and other WebAssembly runtimes.
The package contains the compiled engine; consumers do not need Rust or a separate
download.

Full documentation, the constraint reference and benchmarks live at
[packvium.com](https://packvium.com).

## Install

```bash
npm install @packvium/browser
```

## Quick start

```js
import { init, pack } from '@packvium/browser';

await init();   // fetches and instantiates the module once; later calls reuse it

const result = await pack(request);
console.log(result.status);          // "feasible"

// A refusal is an answer, not an error -- it never throws.
for (const unpacked of result.unpacked_items) {
  console.log(unpacked.item_id, unpacked.reason);
}
```

`init()` loads and initializes the module once. `pack()` accepts an object and returns
an object, while `packJson()` is the allocation-conscious JSON-string interface. A
custom loader may be passed to `init()` for a bundler or test environment — Node cannot
`fetch` the web-target module off disk, so [`examples/basic.mjs`](examples/basic.mjs)
shows the loader that reads the bytes from disk instead.

### Quoting, policy and catalog versions

`commerce` provides the same deterministic commercial/control-plane API as every other
Packvium package — `quote()`, `evaluatePolicy()` and `catalogVersionInfo()`, all over one
document you supply, with no server round-trip:

```js
import { commerce } from '@packvium/browser';

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
console.log(quote.quote.total_minor);
```

The full contract — document format, every result shape, all rejection codes — is
`docs/COMMERCE-API.md`.

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

## Documentation

| Document | Covers |
| --- | --- |
| [docs/GUARANTEES.md](docs/GUARANTEES.md) | What is promised and what is not. Start here. |
| [docs/PUBLIC-API.md](docs/PUBLIC-API.md) | Inputs, outputs and status semantics. |
| [docs/UNITS-AND-NUMERICS.md](docs/UNITS-AND-NUMERICS.md) | Units, accepted input forms, rounding policy. |
| [docs/COMMERCE-API.md](docs/COMMERCE-API.md) | The commercial/control-plane contract. |

## The Packvium family

One request and result contract, implemented independently in four engines (Rust,
Python, PHP, JavaScript) and held to identical placements on a shared fixture set.
Pick the package for your stack; mixing them in one system is safe.

Documentation, the constraint reference and the benchmarks are at
[packvium.com](https://packvium.com).

| Package | Install | Source |
| --- | --- | --- |
| Python — [`packvium`](https://pypi.org/project/packvium/) | `pip install packvium` | [packvium-python](https://github.com/toxakara/packvium-python) |
| PHP — [`packvium/packvium`](https://packagist.org/packages/packvium/packvium) | `composer require packvium/packvium` | [packvium-php](https://github.com/toxakara/packvium-php) |
| Rust — [`packvium`](https://crates.io/crates/packvium) | `packvium = "1.0"` | [packvium-rust](https://github.com/toxakara/packvium-rust) |
| Node.js — [`@packvium/engine`](https://www.npmjs.com/package/@packvium/engine) | `npm install @packvium/engine` | [packvium-node](https://github.com/toxakara/packvium-node) |
| Browser / WebAssembly — [`@packvium/browser`](https://www.npmjs.com/package/@packvium/browser) | `npm install @packvium/browser` | [packvium-wasm](https://github.com/toxakara/packvium-wasm) |
| PHP FFI bridge — [`packvium/native-bridge`](https://packagist.org/packages/packvium/native-bridge) | `composer require packvium/native-bridge` | [packvium-php-bridge](https://github.com/toxakara/packvium-php-bridge) |
| Python native selector — `packvium-native` | from source until the native wheels ship | [packvium-python-adapter](https://github.com/toxakara/packvium-python-adapter) |

## Requirements

- a browser or bundler runtime with WebAssembly and dynamic `import()` support;
- a custom `init()` loader in runtimes that cannot fetch a package-relative WASM URL.

The release tarball is assembled and tested together with the canonical Rust source.
Its repository CI then tests the exact committed module, and tagged releases publish
only after the package version and generated files have been verified.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through the process in
[SECURITY.md](SECURITY.md), not public issues.

## License

MIT. See [LICENSE](LICENSE).
