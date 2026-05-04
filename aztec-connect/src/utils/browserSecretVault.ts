// Encrypted-at-rest secret for @honkers/aztec-connect (browser only).
const LEGACY = "aztec-connect:secret";
const V2 = "aztec-connect:secret-v2";
const WRAP = "aztec-connect:vault-wrap";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string): Uint8Array {
  const n = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(n.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(n.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function getOrCreateWrapKey(): Promise<CryptoKey> {
  let hex = localStorage.getItem(WRAP);
  if (!hex || hex.length !== 64) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    hex = bytesToHex(raw);
    localStorage.setItem(WRAP, hex);
  }
  return crypto.subtle.importKey("raw", hexToBytes(hex), "AES-GCM", false, ["encrypt", "decrypt"]);
}

const PREFIX = "v2:";

export async function persistEncryptedSecret(secretHex: string): Promise<void> {
  const key = await getOrCreateWrapKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(secretHex);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  localStorage.setItem(V2, PREFIX + bytesToHex(combined));
  localStorage.removeItem(LEGACY);
}

export async function loadDecryptedSecretHex(): Promise<string | null> {
  const v2 = localStorage.getItem(V2);
  if (v2?.startsWith(PREFIX)) {
    try {
      const key = await getOrCreateWrapKey();
      const combined = hexToBytes(v2.slice(PREFIX.length));
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12));
      return new TextDecoder().decode(plain);
    } catch {
      return null;
    }
  }
  const legacy = localStorage.getItem(LEGACY);
  if (legacy?.trim()) return legacy.trim().startsWith("0x") ? legacy.trim() : `0x${legacy.trim()}`;
  return null;
}

export async function migrateLegacyPlaintextIfPresent(): Promise<void> {
  const legacy = localStorage.getItem(LEGACY);
  if (!legacy?.trim() || localStorage.getItem(V2)) return;
  const hex = legacy.trim().startsWith("0x") ? legacy.trim() : `0x${legacy.trim()}`;
  await persistEncryptedSecret(hex);
}

export function hasStoredWalletSecret(): boolean {
  return Boolean(localStorage.getItem(V2) || localStorage.getItem(LEGACY));
}
