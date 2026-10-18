/**
 * The errors `@packvium/engine` throws, thrown here too, so a refusal moves between
 * the two packages unchanged: the same class names, the same base classes, and the same
 * `code`, `reason`, `field` and `detail` (docs/ERRORS.md).
 *
 * The classes are this package's own -- it depends on nothing -- and `test/errors.test.mjs`
 * constructs each beside the engine's and compares name, message, code and fields. The
 * WebAssembly module raises a plain `Error` whose properties carry the core's structured
 * refusal; `fromWasm` turns it into the class it stands for.
 */

/** The request is not one any engine may answer. Nothing was solved. */
export class InvalidRequestError extends RangeError {
  static code = 'invalid_request';

  /** The message a subclass may respell; it runs before `this` exists, so it is static. */
  static describe(field, detail) {
    return field ? `${this.code}: ${field}: ${detail}` : `${this.code}: ${detail}`;
  }

  constructor(reason, field, detail) {
    super(new.target.describe(field, detail));
    this.name = 'InvalidRequestError';
    this.code = new.target.code;
    this.reason = reason;
    this.field = field;
    this.detail = detail;
  }
}

/** A fixed placement that is malformed or cannot hold. */
export class FixedPlacementError extends InvalidRequestError {
  static code = 'invalid_fixed_placement';

  static describe(field, detail) {
    return `${this.code}: ${detail}`;
  }

  constructor(detail, reason = 'cannot_hold', field = '/fixed_placements') {
    super(reason, field, detail);
    this.name = 'FixedPlacementError';
  }
}

/**
 * The request uses a public field this engine does not implement yet; it was not ignored.
 * Constructed from `fields` with the engine's own sentence, so a caller who builds one gets the
 * error `@packvium/engine` builds.
 */
export class UnsupportedFeatureError extends Error {
  constructor(fields) {
    super(`unsupported_feature: JavaScript fallback does not yet implement ${fields.join(', ')}; `
      + 'the request was rejected instead of silently ignoring public fields');
    this.name = 'UnsupportedFeatureError';
    this.code = 'unsupported_feature';
    this.fields = fields;
  }
}

/** A commerce document or request the contract does not define (docs/COMMERCE-API.md). */
export class CommerceInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CommerceInputError';
  }
}

/**
 * The result is not a document the reference validator can judge (docs/VALIDATION-CONTRACT.md).
 * `kind` is `contract` when the reference raises `MalformedResult` with this same message,
 * `shape` when it fails on the input another way. The same class `@packvium/engine` throws.
 */
export class MalformedResult extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'MalformedResult';
    this.kind = kind;
  }
}

/**
 * The fields the core names in its one unsupported-feature sentence
 * (`packvium-core` `api.rs`, "does not yet implement a, b; the request was rejected ...").
 * Read from the message because the core keeps only that sentence (`PackError::UnsupportedFeature`
 * holds a `String`), so the binding has no field list to hand over. `test/errors.test.mjs` pins
 * the sentence against `api.rs` and against the real module, so a rewording fails a test rather
 * than emptying `fields`.
 */
const UNSUPPORTED_FIELDS = /does not yet implement (.+?); the request was rejected/;

/**
 * The class a WebAssembly refusal stands for, or the error itself when it is not one: any
 * other core error keeps its message and `code` as raised.
 */
export function fromWasm(error) {
  if (!(error instanceof Error)) {
    return error;
  }
  if (error.name === 'CommerceInputError') {
    return new CommerceInputError(error.message);
  }
  if (error.code === InvalidRequestError.code) {
    return new InvalidRequestError(error.reason, error.field, error.detail);
  }
  if (error.code === FixedPlacementError.code) {
    return new FixedPlacementError(error.detail, error.reason, error.field);
  }
  if (error.code === 'unsupported_feature') {
    return unsupportedFromWasm(error.message);
  }
  return error;
}

/** The core's refusal as the engine's class, keeping the core's own sentence as the message. */
function unsupportedFromWasm(message) {
  const named = UNSUPPORTED_FIELDS.exec(message);
  const translated = new UnsupportedFeatureError(named ? named[1].split(', ') : []);
  // The sentence names the engine that refused -- here the Rust core, not the JavaScript fallback.
  translated.message = message;
  return translated;
}
