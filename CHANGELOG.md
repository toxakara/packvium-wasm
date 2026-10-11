# Changelog

What changed in `@packvium/browser` on npm, release by release. The format follows
[Keep a Changelog](https://keepachangelog.com/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0]

A rebuild of the WebAssembly engine on the 1.6.0 Rust core: boxes cut to measure, flat bags,
stacking groups and a volume-first objective in the request, and a fix for small orders with a
`convex_hull` item.

### Added

- **`rebalanceWeight(request, result, {maxMoves})`**, the same call as in `@packvium/engine`.
- **`made_to_measure`, `deformable_boundary: {kind: "flat_bag"}`, `stacking_group` /
  `accepts_stacking_groups` and `objective: "maximum_volume"`** in the request, and
  `achieved_dimensions` and `made_to_measure` in the result.
- **A warning for items resting on nothing** when `minimum_support_ratio` is 0. No answer
  changes.

### Changed

- **An unpacked item names the limit that left it out, the same in every engine.**
  Where the search used to fall back to `no_feasible_placement` or `search_exhausted`, an item a
  fresh container would take but none is left reports `container_inventory_exhausted`, and one
  that overloads an axle wherever it stands alone reports `axle_overloaded`; both are
  `inferred`. Code that matched the old reason for these cases must match the new one.
- **An explicit `solvers: ["homogeneous_blocks"]` request packs in the profile's start order
  when the block solver declines the scene**, so the answer no longer depends on the
  order the items are listed in.
- **`quality` orders its beam by a `convex_hull` item's own solid**, not its box, so
  it no longer assumes a second wedge cannot fit when it can.
- **The container plan counts a `convex_hull` item by its own solid too**, so
  `quality` no longer ranks a plan as if wedges that share a container each needed their own.
- **`fast` and `balanced` add the block solver as one more start** and keep its answer only
  when strictly better.

### Fixed

- **Small orders with a `convex_hull` item finish in a handful of search nodes** instead of
  spending the whole time limit.
- **`max_payload` holds in the block and grid solvers.** Their capacity cap narrowed weights
  to 32 bits, so a payload limit above about 537 g was read wrong and a block could overfill
  the container.

## [1.5.0]

A rebuild of the WebAssembly engine on the 1.5.0 Rust core. No API changes. Searches are
faster, and a misspelt configuration key is now refused (see *Fixed*).

### Changed

- **Faster searches, same results.** The Rust core's collision index keeps its cells in a flat
  array instead of a tree; natively that made beam searches 41% faster. Every result is
  byte-identical.

### Fixed

- **`quality` with `minimum_support_ratio` answers instead of failing** with
  `solution_failed_validation`, and a block answer reports the support each item really has
  rather than 1.0 for every item.
- **A misspelt `configuration` key is refused.** A key the request schema does not declare in
  `configuration` or its `effort_budget` (`profile` for `solver_profile`, `top_k` for
  `alternatives`) was silently ignored, so the request ran on defaults. It is now refused with
  reason `not_allowed` and the key's pointer, for example `/configuration/profile`. `parallel`
  is refused too; this build always runs search starts in sequence.
- **An item that fits no orientation no longer spends the exact search's budget**; the search
  now finishes instead of reporting `effort_limit`. Placements are unchanged.
- **An unknown `objective` or access direction is refused with its pointer** (`not_allowed`),
  and refusal messages match the documentation.

## [1.4.0]

A rebuild of the WebAssembly engine on the 1.4.0 Rust core. A request the schema never
allowed is now refused instead of packed (see *Fixed*).

### Added

- **`fixed_placements`** in a request: items already loaded keep their place, count toward
  weight, support and top load, and come back marked `fixed: true`.
- **A malformed request's error names the bad value**: its message reads
  `invalid_request: /items/0/quantity: must be at least 1`, with a reason from a closed set.

### Changed

- **The compiled beam search keeps its speed without its memory cost.** Results are
  byte-identical.
- **Container ids number each type from 1**, as the other engines number them. Only answers
  with more than one container type change, and only their ids.

### Fixed

- **Numbers below their floor are refused.** A negative item or container quantity was packed,
  and a zero or negative limit was silently replaced by its default.
- **A placement or obstacle far outside its container is refused** instead of wrapping around
  and looking inside it.

Plan revisions are not exposed by this package.

## [1.3.0]

A rebuild of the WebAssembly engine on the 1.3.0 Rust core. No API changes; nothing breaks 1.2.0.

### Changed

- **The compiled beam search caches its sort keys** instead of recomputing them. Results are
  byte-identical.

Operational artifacts are not exposed by this package.

## [1.2.0]

A rebuild of the WebAssembly engine on the 1.2.0 Rust core. No API changes; nothing breaks 1.1.0.

### Changed

- **Faster group batching** in the compiled solver: two quadratic scans over group members
  became a single pass. Results are byte-identical.
- The README now lists `examples/shapes.mjs` (convex-hull and compressible items).

Execution plans are not exposed by this package.

## Earlier releases

Up to 1.1.0 one changelog covered every Packvium language. Those entries are kept in
this repository's GitHub Releases for each tag.
