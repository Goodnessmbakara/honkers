// ---------------------------------------------------------------------------
// usePXE — contract interactions via connected extension wallet (Aztec v4.2.0)
//
// Works with any Aztec wallet extension (Azguard, Obsidion, …).
// The wallet satisfies the full Wallet/PXE interface.
// Health check uses raw JSON-RPC to the node (independent of wallet state).
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from "react";
import { aztecConfig } from "../config/aztec";
import { getArtifact } from "../config/contractArtifacts";
import { useWalletContext } from "../contexts/WalletContext";
import { Contract } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { ensureContractRegisteredWithPXE } from "../utils/ensureContractRegistered";

interface PxeHealth {
  ok: boolean;
  blockNumber: number | null;
  error: string | null;
}

/** Raw note fields decoded from wallet PXE (PrivateSet note preimage). */
export type PrivateNotePayload = { items: bigint[] };

export function usePXE() {
  const { wallet, aztecNode } = useWalletContext();
  const [health, setHealth] = useState<PxeHealth>({ ok: false, blockNumber: null, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(aztecConfig.pxeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getNodeInfo", params: [] }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      const info = json.result as { blockNumber?: number };
      setHealth({ ok: true, blockNumber: info.blockNumber ?? null, error: null });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setHealth({ ok: false, blockNumber: null, error: msg });
      return false;
    }
  }, []);

  const getPrivateNotes = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_owner: string, _contractAddress: string, _storageSlot: number): Promise<PrivateNotePayload[]> => {
      // getIncomingNotes is not on the standard Wallet interface in 4.2.0.
      // Extension wallets manage note decryption internally; callers should
      // rely on the wallet extension's own UI for balance display.
      return [];
    },
    [],
  );

  /** Simulate a public/utility view function (no tx, no proof). */
  const simulateView = useCallback(
    async (contractAddress: string, functionName: string, args: unknown[]) => {
      if (!wallet || !aztecNode) {
        throw new Error("Wallet not connected. Connect a wallet first.");
      }
      const artifact = getArtifact(contractAddress);
      await ensureContractRegisteredWithPXE(wallet, aztecNode, contractAddress, artifact);
      const address = AztecAddress.fromString(contractAddress);
      const contract = Contract.at(address, artifact, wallet);
      const fn = contract.methods[functionName] as (...a: unknown[]) => { simulate: () => Promise<unknown> };
      return fn(...args).simulate();
    },
    [wallet, aztecNode],
  );

  const simulateAndProve = useCallback(
    async (
      contractAddress: string,
      functionName: string,
      args: unknown[],
      from: string,
      onStep?: (step: string) => void,
    ) => {
      if (!wallet || !aztecNode) {
        throw new Error("Wallet not connected. Connect a wallet first.");
      }

      abortRef.current = new AbortController();
      onStep?.("witness");

      try {
        const artifact = getArtifact(contractAddress);
        await ensureContractRegisteredWithPXE(wallet, aztecNode, contractAddress, artifact);
        const address = AztecAddress.fromString(contractAddress);
        const contract = Contract.at(address, artifact, wallet);

        onStep?.("proving");

        const fromAddress = AztecAddress.fromString(from);
        const sentTx = await contract.methods[functionName](...(args as never[])).send({
          from: fromAddress,
        });

        onStep?.("submitting");
        onStep?.("confirming");

        console.log("[usePXE] sentTx type:", typeof sentTx, "value:", sentTx);

        // Azguard's sendTx returns the raw result directly, not a SentTx wrapper.
        // Walk every possible shape to extract a tx hash string.
        // Azguard shape (confirmed): { offchainEffects, offchainMessages, receipt: { txHash } }
        const extractHash = (v: unknown): string | undefined => {
          if (!v) return undefined;
          if (typeof v === "string" && v.startsWith("0x")) return v;
          // SentTx with .wait()
          if (typeof v === "object" && "wait" in (v as object) &&
              typeof (v as { wait: unknown }).wait === "function") {
            return undefined; // handled async below
          }
          const obj = v as Record<string, unknown>;
          // Azguard: { receipt: { txHash } }
          if (obj.receipt) return extractHash(obj.receipt);
          // Direct txHash property
          if (obj.txHash) return extractHash(obj.txHash);
          // object with .toString() that looks like a hex hash
          const s = String(v);
          if (s.startsWith("0x") && s.length >= 10) return s;
          return undefined;
        };

        let hash: string | undefined = extractHash(sentTx);

        // If sentTx has .wait(), call it and extract from receipt
        if (!hash && sentTx && typeof sentTx === "object" && "wait" in (sentTx as object) &&
            typeof (sentTx as { wait: unknown }).wait === "function") {
          const receipt = await (sentTx as { wait: () => Promise<unknown> }).wait();
          console.log("[usePXE] receipt:", receipt);
          hash = extractHash(receipt) ?? extractHash((receipt as { txHash?: unknown })?.txHash);
        }

        onStep?.("confirmed");
        console.log("[usePXE] extracted hash:", hash);
        if (!hash) throw new Error("Transaction submitted but no tx hash returned. Check console for sentTx shape.");
        return hash;
      } catch (err) {
        if (abortRef.current?.signal.aborted) {
          throw new Error("Proof generation cancelled");
        }
        throw err;
      }
    },
    [wallet, aztecNode],
  );

  const cancelProof = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { health, checkHealth, getPrivateNotes, simulateView, simulateAndProve, cancelProof };
}
