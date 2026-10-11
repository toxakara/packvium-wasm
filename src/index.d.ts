export interface PackviumWasmModule {
  default?: () => Promise<unknown>;
  pack_json(request: string): string;
  rebalance_json?(request: string, result: string, maxMoves: number): string;
  commerce_quote_json?(call: string): string;
  commerce_evaluate_policy_json?(call: string): string;
  commerce_catalog_version_info_json?(call: string): string;
}

export type WasmModuleLoader = () => Promise<PackviumWasmModule>;

/** One canonical commerce result document: see docs/COMMERCE-API.md. */
export type CommerceResult = Record<string, unknown>;

export function init(loader?: WasmModuleLoader): Promise<PackviumWasmModule>;
export function pack(request: unknown): Promise<Record<string, unknown>>;
export function packJson(request: string): Promise<string>;
/** One move of a rebalanced result: which item went from which container to which. */
export interface WeightMove {
  item_id: string;
  from_container_id: string;
  to_container_id: string;
}
/** The rebalanced containers, the moves that produced them, and whether anything improved. */
export interface RebalanceResult {
  containers: unknown[];
  moves: WeightMove[];
  improved: boolean;
}
/** Same as `@packvium/engine`'s `rebalanceWeight`; `maxMoves` defaults to 64. */
export function rebalanceWeight(
  request: unknown,
  result: unknown,
  options?: { maxMoves?: number },
): Promise<RebalanceResult>;
export const commerce: {
  quote(document: unknown, request: unknown): Promise<CommerceResult>;
  evaluatePolicy(document: unknown, request: unknown): Promise<CommerceResult>;
  catalogVersionInfo(document: unknown, request: unknown): Promise<CommerceResult>;
};
