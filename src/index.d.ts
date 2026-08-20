export interface PackviumWasmModule {
  default?: () => Promise<unknown>;
  pack_json(request: string): string;
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
export const commerce: {
  quote(document: unknown, request: unknown): Promise<CommerceResult>;
  evaluatePolicy(document: unknown, request: unknown): Promise<CommerceResult>;
  catalogVersionInfo(document: unknown, request: unknown): Promise<CommerceResult>;
};
