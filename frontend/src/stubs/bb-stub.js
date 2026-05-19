// Stub: @aztec/bb.js (barretenberg WASM prover) not needed in browser.
// All proving happens in the Azguard Chrome extension.

// randomBytes is used at import time by @aztec/foundation/crypto/random — must work
export const randomBytes = (len) => crypto.getRandomValues(new Uint8Array(len));

// Stub class factory — returns a class that throws if instantiated
const stubClass = (name) => class {
  constructor() { throw new Error(`${name} unavailable in browser — use Azguard wallet`); }
  static new() { throw new Error(`${name} unavailable in browser — use Azguard wallet`); }
  static initSingleton() { return Promise.resolve(); }
};

export const Barretenberg = stubClass('Barretenberg');
export const BarretenbergSync = stubClass('BarretenbergSync');
export const AztecClientBackend = stubClass('AztecClientBackend');
export const UltraHonkBackend = stubClass('UltraHonkBackend');
export const RawBuffer = stubClass('RawBuffer');
export const BN254_G1_GENERATOR = null;
export const BN254_G2_GENERATOR = null;

export default {};
