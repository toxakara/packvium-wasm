# @packvium/browser

Packvium's deterministic packing engine for browsers and other WebAssembly runtimes.
The package contains the compiled engine; consumers do not need Rust or a separate
download.

Use it to pick the smallest carton for an order, build a pallet, load a shipping container,
or load a truck within its axle ratings and delivery-stop order, all client-side with no
server round trip. Every answer comes back as coordinates and rotations for each item, with
a reason for anything that did not fit. Under the `default` and `lowest_cost` objectives it
also states `optimality.lower_bound`: a complete answer that attains it reports `optimal`,
which proves no packing obeying the request's rules scores better, and any other carries the
gap to the bound.

Full documentation, the constraint reference and benchmarks live at
[packvium.com](https://packvium.com).

## Install

```bash
npm install @packvium/browser
```

## Quick start

```js
import { init, pack } from '@packvium/browser';

await init();   // instantiates the module once; later calls reuse it

const request = {
  units: { length: 'mm' },
  configuration: {
    // Stop by counted work, not by the clock, so the answer is the same on any machine.
    // The time limit is only a safety fuse.
    effort_budget: { max_candidates_evaluated: 1000000 },
    time_limit_ms: 60000,
  },
  items: [
    { id: 'mug', quantity: 6, weight: '400 g', dimensions: { length: '120', width: '120', height: '100' } },
    { id: 'ladder', quantity: 1, weight: '6 kg', dimensions: { length: '1800', width: '300', height: '100' } },
  ],
  containers: [
    { id: 'box', max_payload: '15 kg', inner_dimensions: { length: '400', width: '400', height: '400' } },
  ],
};

const result = await pack(request);
console.log(result.status);          // "best_found": the ladder is longer than the box

// A refusal is an answer, not an error -- it never throws.
for (const unpacked of result.unpacked_items) {
  console.log(unpacked.item_id, unpacked.reason);   // ladder#1 no_compatible_container_dimensions
}
```

Every entry point is async, because the WebAssembly module has to be instantiated before the
first call. `init()` does that once and caches it; calling it up front is optional, and keeps
instantiation out of your first user interaction. `pack()` accepts an object and returns an
object, while `packJson()` takes and returns JSON text.

`rebalanceWeight(request, result, { maxMoves })` takes a request and the result packed from it
and moves items between that result's containers to reduce the spread of their payloads,
keeping every move that an independent validation accepts. It has the same name, arguments
and answer as `@packvium/engine`'s `rebalanceWeight`; `maxMoves` defaults to 64.

Support is not required by default: `minimum_support_ratio` is 0, so an item may rest on
nothing above the container floor, and the result then says so in `warnings`
(`unsupported_placements: N placement(s) rest on nothing above the container floor; ...`).
To require support, set it above 0 — `configuration: { minimum_support_ratio: 0.75 }` for three quarters of the base.

Lengths and weights are strings on purpose: they are parsed into exact integers, so `'0.1'` is a
tenth of a millimetre and never `0.09999999999999999`. The request and result are the same JSON
document every Packvium engine reads and writes; this package is the Rust engine compiled to
WebAssembly, so its answers are the Rust engine's own.

### Browsers, bundlers and Node

The package has two entry points, chosen by `package.json`'s `exports` conditions:

- **browsers and bundlers** get the web build, which fetches the `.wasm` file sitting next to
  the module. Serve the package's `src/pkg/` directory with your other assets (bundlers that
  understand `new URL(..., import.meta.url)` do this for you);
- **Node** gets an entry point that reads the same `.wasm` bytes from disk, because Node's
  `fetch` cannot open a `file:` URL. Nothing to configure: `import ... from '@packvium/browser'`
  works in Node 18+, in server-side rendering and in a Node-environment test run.

`init()` also accepts a loader function, for a runtime that can do neither: it must return the
generated module's namespace, already initialized, or one whose `default` export initializes it.

## Deterministic results

`configuration.time_limit_ms` is a wall clock, and how far a search gets in it depends on the
device -- a phone and a workstation can return different answers to the same request when the
clock stops the search. `configuration.effort_budget` counts work instead (candidates evaluated,
placements attempted, search nodes, restarts), so the search stops at the same point on every
device. For anything you store or compare, set an `effort_budget` and a generous `time_limit_ms`
as a fuse. `result.algorithm.time_limit_reached` tells you when the clock decided anyway.

`effort_limit` means the budget stopped work the search still had: a search that finishes on
exactly its budget reads `complete`, and `termination.any_start_truncated` says whether the
budget cut a start that might have won.

## Errors

A request that is wrong -- a missing field, a count of zero, an unknown unit -- is refused before
anything is solved, with the same error classes `@packvium/engine` throws, exported from this
package under the same names:

```js
import { pack, InvalidRequestError } from '@packvium/browser';

try {
  await pack(request);
} catch (error) {
  if (!(error instanceof InvalidRequestError)) throw error;
  showFieldError(error.field, error.detail);   // "/items/0/quantity", "must be at least 1"
}
```

`InvalidRequestError` (a `RangeError`) carries `code`, `reason`, `field` (a JSON Pointer) and
`detail`. `FixedPlacementError`, its subclass, is a fixed placement that is malformed or cannot
hold; `UnsupportedFeatureError` lists the `fields` this engine does not implement yet; text
`packJson()` cannot parse is an `Error` with code `invalid_input`. A request that is valid but does
not fit completely is not an error: the result lists what was left out, and why, in
`unpacked_items`. [`examples/errors.mjs`](examples/errors.mjs) shows each case.

The commerce functions report a malformed document or request as a `CommerceInputError`.

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
[COMMERCE-API.md](https://github.com/toxakara/packvium-wasm/blob/main/docs/COMMERCE-API.md).

## Checking a result

*New in 1.7.0.*

`validate(request, result)` checks a result against the request it answers, from the JSON alone:
geometry, support and load, accounting, the result's facts and its score. It is the same
reference validator every Packvium package exports, so it returns the same list:

```js
import { MalformedResult, pack, validate } from '@packvium/browser';

const issues = await validate(request, await pack(request)); // [] -- valid
// [{ code: 'collision', detail: 'cube#1 with cube#2 in box#1' }] for two boxes in one place
```

It judges any engine's result, not only this package's. A result without the documented shape
rejects with `MalformedResult`, whose `kind` is `contract` or `shape`.

## Examples

Runnable, in [`examples/`](examples). Each one is a single file you can read top to bottom
and execute without a project around it.

| File | What it shows |
| --- | --- |
| [`basic.mjs`](examples/basic.mjs) | Initialize the module, pack an order, read placements, and see why an item was refused. |
| [`objectives.mjs`](examples/objectives.mjs) | Three objectives choosing different boxes for the same order, and `keep_upright`, `incompatible_tags` and `max_top_load` changing what may be packed where. |
| [`errors.mjs`](examples/errors.mjs) | What a refused request looks like across WebAssembly: the error class, and its code, reason, field and detail. |
| [`commerce.mjs`](examples/commerce.mjs) | Quote a shipment in the browser with no server round-trip. |
| [`shapes.mjs`](examples/shapes.mjs) | Items that are not their box: complementary wedges sharing one crate as `convex_hull`, and a cushion that compresses under load until the crush limit refuses it. |

```bash
node examples/basic.mjs
```

All five run unchanged in Node and, through a bundler, in a browser: they import
`@packvium/browser` by name and let the package pick its entry point.

## Documentation

The documentation is in the source repository, not in the npm package.

| Document | Covers |
| --- | --- |
| [GUARANTEES.md](https://github.com/toxakara/packvium-wasm/blob/main/docs/GUARANTEES.md) | What is promised and what is not. Start here. |
| [PUBLIC-API.md](https://github.com/toxakara/packvium-wasm/blob/main/docs/PUBLIC-API.md) | Inputs, outputs and status semantics. |
| [UNITS-AND-NUMERICS.md](https://github.com/toxakara/packvium-wasm/blob/main/docs/UNITS-AND-NUMERICS.md) | Units, accepted input forms, rounding policy. |
| [COMMERCE-API.md](https://github.com/toxakara/packvium-wasm/blob/main/docs/COMMERCE-API.md) | The commercial/control-plane contract. |

## The Packvium family

One request and result contract, implemented independently in four engines (Rust,
Python, PHP, JavaScript) and checked against each other on a shared fixture set: Python and
PHP to identical placements, Rust and JavaScript to a valid packing that scores no worse
than a per-fixture floor.
Pick the package for your stack; mixing them in one system is safe.

Documentation, the constraint reference and the benchmarks are at
[packvium.com](https://packvium.com).

| Package | Install | Source |
| --- | --- | --- |
| Python — [`packvium`](https://pypi.org/project/packvium/) | `pip install packvium` | [packvium-python](https://github.com/toxakara/packvium-python) |
| PHP — [`packvium/packvium`](https://packagist.org/packages/packvium/packvium) | `composer require packvium/packvium` | [packvium-php](https://github.com/toxakara/packvium-php) |
| Rust — [`packvium`](https://crates.io/crates/packvium) | `packvium = "1.8"` | [packvium-rust](https://github.com/toxakara/packvium-rust) |
| Node.js — [`@packvium/engine`](https://www.npmjs.com/package/@packvium/engine) | `npm install @packvium/engine` | [packvium-node](https://github.com/toxakara/packvium-node) |
| Browser / WebAssembly — [`@packvium/browser`](https://www.npmjs.com/package/@packvium/browser) | `npm install @packvium/browser` | [packvium-wasm](https://github.com/toxakara/packvium-wasm) |
| PHP FFI bridge — [`packvium/native-bridge`](https://packagist.org/packages/packvium/native-bridge) | `composer require packvium/native-bridge` | [packvium-php-bridge](https://github.com/toxakara/packvium-php-bridge) |
| Python native selector — `packvium-native` | from source until the native wheels ship | [packvium-python-adapter](https://github.com/toxakara/packvium-python-adapter) |

## Requirements

- a browser or bundler runtime with WebAssembly and dynamic `import()` support, or Node.js 18
  or later (the WebAssembly module uses reference types, which Node 16 cannot load);
- a custom `init()` loader only in a runtime that is neither and cannot fetch a
  package-relative WASM URL.

The release tarball is assembled and tested together with the canonical Rust source.
Its repository CI then tests the exact committed module, and tagged releases publish
only after the package version and generated files have been verified.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through the process in
[SECURITY.md](SECURITY.md), not public issues.

## Citation

If Packvium supports your research, cite it as software. GitHub's **Cite this repository**
button reads [`CITATION.cff`](https://github.com/toxakara/packvium-wasm/blob/main/CITATION.cff), and
[`codemeta.json`](https://github.com/toxakara/packvium-wasm/blob/main/codemeta.json) carries the same record in
CodeMeta form.

```bibtex
@software{packvium_wasm,
  author  = {{Packvium contributors}},
  title   = {Packvium for browsers},
  version = {1.8.0},
  license = {MIT},
  url     = {https://packvium.com}
}
```

## License

MIT. See [LICENSE](LICENSE).
