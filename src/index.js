/**
 * Browser entry point. The WebAssembly module resolves its own `.wasm` next to itself
 * and fetches it, which is exactly right over HTTP and exactly wrong under Node -- see
 * `node.js`, which `package.json`'s `exports` selects there instead.
 */

import { createApi } from './api.js';

export const { commerce, init, pack, packJson } = createApi(
  () => import('./pkg/packvium_wasm.js'),
);
