# Changelog

What changed in `@packvium/browser` on npm, release by release. The format follows
[Keep a Changelog](https://keepachangelog.com/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
