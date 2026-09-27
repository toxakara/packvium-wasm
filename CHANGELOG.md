# Changelog

What changed in `@packvium/browser` on npm, release by release. The format follows
[Keep a Changelog](https://keepachangelog.com/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
