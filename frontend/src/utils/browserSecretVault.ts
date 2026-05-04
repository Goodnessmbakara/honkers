// ---------------------------------------------------------------------------
// Browser secret vault — never persist raw account secret as plaintext.
// Uses AES-256-GCM with a random device-bound wrap key (honkers:vault-wrap-key).
// Legacy honkers:wallet-secret (plaintext) is migrated once then removed.
// ---------------------------------------------------------------------------

const LEGACY_SECRET_KEY = "honkers:wallet-secret";
const V2_PAYLOAD_KEY = "honkers:wallet-secret-v2";
const WRAP_KEY_STORAGE = "honkers:vault-wrap-key";

const V2_PREFIX = "v2:";

function normalizeSecretString(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("0x")) return trimmed;
  if (/^[0-9a-fA-F]+$/.test(trimmed)) return `0x${trimmed}`;
  return trimmed;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function getOrCreateWrapKey(): Promise<CryptoKey> {
  let hex = localStorage.getItem(WRAP_KEY_STORAGE);
  if (!hex || hex.length !== 64) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    hex = bytesToHex(raw);
    localStorage.setItem(WRAP_KEY_STORAGE, hex);
  }
  const rawKey = hexToBytes(hex);
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function persistEncryptedSecret(secretHex: string): Promise<void> {
  const key = await getOrCreateWrapKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(secretHex);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  localStorage.setItem(V2_PAYLOAD_KEY, V2_PREFIX + bytesToHex(combined));
  localStorage.removeItem(LEGACY_SECRET_KEY);
}

export async function loadDecryptedSecretHex(): Promise<string | null> {
  const v2 = localStorage.getItem(V2_PAYLOAD_KEY);
  if (v2?.startsWith(V2_PREFIX)) {
    try {
      const key = await getOrCreateWrapKey();
      const combined = hexToBytes(v2.slice(V2_PREFIX.length));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
      return normalizeSecretString(new TextDecoder().decode(plain));
    } catch {
      return null;
    }
  }

  const legacy = localStorage.getItem(LEGACY_SECRET_KEY);
  if (legacy?.trim()) {
    return normalizeSecretString(legacy);
  }
  return null;
}

/** One-time migration: plaintext -> v2 ciphertext, remove plaintext. */
export async function migrateLegacyPlaintextIfPresent(): Promise<void> {
  const legacy = localStorage.getItem(LEGACY_SECRET_KEY);
  if (!legacy?.trim() || localStorage.getItem(V2_PAYLOAD_KEY)) return;
  const hex = legacy.trim().startsWith("0x") ? legacy.trim() : `0x${legacy.trim()}`;
  await persistEncryptedSecret(hex);
}

export function clearSecretStorage(): void {
  localStorage.removeItem(V2_PAYLOAD_KEY);
  localStorage.removeItem(LEGACY_SECRET_KEY);
  localStorage.removeItem(WRAP_KEY_STORAGE);
}

export function hasStoredWalletSecret(): boolean {
  return Boolean(localStorage.getItem(V2_PAYLOAD_KEY) || localStorage.getItem(LEGACY_SECRET_KEY));
}

/** For Backup UI: current secret hex if decryptable (includes legacy until migrated). */
export async function readWalletSecretHexForBackup(): Promise<string | null> {
  await migrateLegacyPlaintextIfPresent();
  return loadDecryptedSecretHex();
}
