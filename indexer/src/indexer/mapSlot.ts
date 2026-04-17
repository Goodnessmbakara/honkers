// ---------------------------------------------------------------------------
// Aztec public map storage slot = poseidon2([base_slot, key])
// Base slot indices match tests/integration/src/artifacts/* ContractStorageLayout.
// ---------------------------------------------------------------------------

import { poseidon2Hash } from "@aztec/foundation/crypto/poseidon";
import { Fr } from "@aztec/foundation/curves/bn254";

/**
 * Derive the public storage slot for a Map<Field, PublicMutable<...>> entry.
 */
export async function deriveMapSlot(baseSlot: bigint, mapKey: bigint): Promise<string> {
  const h = await poseidon2Hash([new Fr(baseSlot), new Fr(mapKey)]);
  return h.toString();
}
