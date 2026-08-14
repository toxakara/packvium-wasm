# `@packvium/wasm`

The package exposes the same Rust core used by the CLI, C ABI and native Node
binding. Its public operations are `pack_json(request)`,
`rebalance_json(request, result, max_moves)` and `version()`.

```js
import init, {
  pack_json as packJson,
  rebalance_json as rebalanceJson,
} from "@packvium/wasm";

await init();
const result = JSON.parse(packJson(JSON.stringify(request)));
const balanced = JSON.parse(rebalanceJson(
  JSON.stringify(request),
  JSON.stringify(result),
  64,
));
```

Run `npm test` to build the web-target package, execute its Node round trip, run
the Rust/WASM tests in headless Chrome and inspect the publishable artifact.
`test/browser-smoke.html` is also a framework-independent browser smoke page for
manual or UI-driven verification of the generated package.

The browser test uses `chromedriver` from `PATH`, or the absolute path supplied
in `CHROMEDRIVER`. The driver major version must match the installed Chrome major
version; this avoids `wasm-pack` silently downloading a newer incompatible driver.
