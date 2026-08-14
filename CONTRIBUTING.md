# Contributing

Thanks for looking. This package is a thin wrapper — please keep it that way.

## Getting set up

```bash
npm test
```

The test suite exercises the loader contract (`init()`'s caching, initialization and
`pack()`/`packJson()` routing) and the assembled repository includes a smoke test against
the shipped engine. Day-to-day wrapper work can still run the contract test without a
Rust toolchain; release assembly is responsible for the real module.

## The rules that matter here

**This package does no computation of its own.** `src/index.js` loads a module and
forwards calls to it. Feature work — new solver behaviour, new constraints, anything
that changes what a packing request returns — belongs in the Rust engine, not here.

**The loader stays swappable.** `init(loader)` exists so callers (and tests) can control
how the WASM module is fetched — a bundler-specific import, a CDN URL, a stand-in for
testing. Do not hardcode the default import path deeper into the module; route
everything through `init()`.

**One module initialization per process.** `init()` caches the complete import-and-init
promise at module scope on purpose: compiling and instantiating WebAssembly is not free,
and nothing here should trigger it twice. If you add a code path that bypasses the cache,
that is a regression, not an optimization.

## Pull requests

- One logical change per pull request.
- Commit messages in imperative mood, under 72 characters:
  `type(scope): description` with `feat`, `fix`, `refactor`, `chore`, `docs` or `test`.
- Add or update tests. `npm test` must pass.
- Do not bump the version; releases are cut separately.

## Reporting a bug

If the bug is in what a packing request returns, it almost certainly belongs against the
Rust engine, not this wrapper — please include the full request that reproduces it.

For anything with security implications, follow [SECURITY.md](SECURITY.md) rather than
opening a public issue.
