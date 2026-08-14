export interface PackviumWasmModule {
  default?: () => Promise<unknown>;
  pack_json(request: string): string;
}

export type WasmModuleLoader = () => Promise<PackviumWasmModule>;

export function init(loader?: WasmModuleLoader): Promise<PackviumWasmModule>;
export function pack(request: unknown): Promise<Record<string, unknown>>;
export function packJson(request: string): Promise<string>;
