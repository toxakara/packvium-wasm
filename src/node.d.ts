/**
 * Node entry point. Same surface as the browser build, plus the loader factory the
 * tests use -- see `node.js` for why Node needs its own binding at all.
 */

import type { PackviumWasmModule, RebalanceResult, ResultIssue, WasmModuleLoader } from './index.d.ts';

export {
  CommerceInputError,
  FixedPlacementError,
  InvalidRequestError,
  MalformedResult,
  UnsupportedFeatureError,
} from './index.d.ts';
export type {
  CommerceResult,
  InvalidRequestReason,
  PackviumWasmModule,
  RebalanceResult,
  ResultIssue,
  WasmModuleLoader,
  WeightMove,
} from './index.d.ts';

/**
 * A loader that reads the WebAssembly off disk and initializes the module with the bytes,
 * because `fetch` will not read a `file:` URL. The bytes' location and the module import are
 * parameters so the loader can be exercised against a stand-in module and a minimal `.wasm`.
 */
export function createNodeLoader(
  wasmUrl?: URL | string,
  importModule?: () => Promise<Record<string, unknown>>,
): WasmModuleLoader;

export function init(loader?: WasmModuleLoader): Promise<PackviumWasmModule>;
export function pack(request: unknown): Promise<Record<string, unknown>>;
export function packJson(request: string): Promise<string>;
export function rebalanceWeight(
  request: unknown,
  result: unknown,
  options?: { maxMoves?: number },
): Promise<RebalanceResult>;
export function validate(request: unknown, result: unknown): Promise<ResultIssue[]>;
export const commerce: {
  quote(document: unknown, request: unknown): Promise<Record<string, unknown>>;
  evaluatePolicy(document: unknown, request: unknown): Promise<Record<string, unknown>>;
  catalogVersionInfo(document: unknown, request: unknown): Promise<Record<string, unknown>>;
};
