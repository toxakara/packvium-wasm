export interface PackviumWasmModule {
  default?: () => Promise<unknown>;
  pack_json(request: string): string;
  rebalance_json?(request: string, result: string, maxMoves: number): string;
  commerce_quote_json?(call: string): string;
  commerce_evaluate_policy_json?(call: string): string;
  commerce_catalog_version_info_json?(call: string): string;
  validate_json?(request: string, result: string): string;
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
/** One way a result fails to be a sound answer to its request (docs/VALIDATION-CONTRACT.md). */
export interface ResultIssue {
  code: string;
  detail: string;
}

/** The reference validator's issues, identical to `@packvium/engine`'s; empty when valid. */
export function validate(request: unknown, result: unknown): Promise<ResultIssue[]>;

export const commerce: {
  quote(document: unknown, request: unknown): Promise<CommerceResult>;
  evaluatePolicy(document: unknown, request: unknown): Promise<CommerceResult>;
  catalogVersionInfo(document: unknown, request: unknown): Promise<CommerceResult>;
};

/** Why a request was refused: a closed set shared by all four engines (docs/ERRORS.md). */
export type InvalidRequestReason =
  | 'missing_field'
  | 'wrong_type'
  | 'below_minimum'
  | 'above_maximum'
  | 'negative_measure'
  | 'invalid_unit'
  | 'duplicate_id'
  | 'not_allowed'
  | 'invalid_value';

/**
 * The request is not one any engine may answer; nothing was solved. `field` is the RFC 6901
 * JSON Pointer of the offending value, `''` for the request as a whole. The same class
 * `@packvium/engine` throws.
 */
export class InvalidRequestError extends RangeError {
  readonly code: string;
  readonly reason: string;
  readonly field: string;
  readonly detail: string;
  constructor(reason: InvalidRequestReason, field: string, detail: string);
}

/** The request's fixed placements are malformed or cannot all hold; refused before any search. */
export class FixedPlacementError extends InvalidRequestError {
  readonly code: 'invalid_fixed_placement';
  readonly reason: 'malformed' | 'cannot_hold';
  constructor(detail: string, reason?: 'malformed' | 'cannot_hold', field?: string);
}

/**
 * The request uses a public field this engine does not implement yet; it was not ignored.
 * Constructed from `fields`, exactly as `@packvium/engine`'s is.
 */
export class UnsupportedFeatureError extends Error {
  readonly code: 'unsupported_feature';
  readonly fields: string[];
  constructor(fields: string[]);
}

/** A commerce document or request the contract does not define. */
export class CommerceInputError extends Error {
  readonly name: 'CommerceInputError';
  constructor(message: string);
}

/** The result does not have the documented shape; `kind` says how the reference answers it. */
export class MalformedResult extends Error {
  readonly kind: 'contract' | 'shape';
  constructor(message: string, kind: 'contract' | 'shape');
}
