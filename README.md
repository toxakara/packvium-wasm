# @packvium/browser

Packvium's deterministic packing engine for browsers and other WebAssembly runtimes.
The package contains the compiled engine; consumers do not need Rust or a separate
download.

```js
import { pack } from '@packvium/browser';

const result = await pack(request);
```

`init()` loads and initializes the module once. `pack()` accepts an object and returns
an object, while `packJson()` is the allocation-conscious JSON-string interface. A
custom loader may be passed to `init()` for a bundler or test environment.

## Requirements

- a browser or bundler runtime with WebAssembly and dynamic `import()` support;
- a custom `init()` loader in runtimes that cannot fetch a package-relative WASM URL.

The release tarball is assembled and tested together with the canonical Rust source.
Its repository CI then tests the exact committed module, and tagged releases publish
only after the package version and generated files have been verified.
