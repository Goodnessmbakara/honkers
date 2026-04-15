// ---------------------------------------------------------------------------
// usePXE — contract interactions via BrowserEmbeddedWallet (Aztec v4.1.3)
//
// Health check uses raw JSON-RPC to the node.
// All contract calls (simulate, prove, send) go through the local wallet.
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from "react";
import { aztecConfig } from "../config/aztec";
import { getArtifact } from "../config/contractArtifacts";
import { useAztecWallet } from "./useAztecWallet";
import { Contract } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/aztec.js/addresses";

interface PxeHealth {
  ok: boolean;
  blockNumber: number | null;
  error: string | null;
}

export function usePXE() {
  const { pxeInstance } = useAztecWallet();
  const wallet = pxeInstance?.wallet ?? null;
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
    async (_owner: string, _contractAddress: string) => {
      // In v4.1.3, private notes are queried via contract view functions
      // through the local PXE, not via a generic "getNotes" RPC.
      // This is a stub — individual components should call contract
      // view/utility functions directly via the wallet.
      console.warn("[usePXE] getPrivateNotes is a stub in v4.1.3. Use contract view functions instead.");
      return [] as unknown[];
    },
    [],
  );

  const simulateAndProve = useCallback(
    async (
      contractAddress: string,
      functionName: string,
      args: unknown[],
      from: string,
      onStep?: (step: string) => void,
    ) => {
      if (!wallet) throw new Error("Wallet not initialized. Wait for AztecProvider to load.");

      abortRef.current = new AbortController();
      onStep?.("witness");

      try {
        // Look up artifact and create Contract instance
        const artifact = getArtifact(contractAddress);
        const address = AztecAddress.fromString(contractAddress);
        const contract = Contract.at(address, artifact, wallet);

        onStep?.("proving");

        // The SDK handles simulation + proving + submission internally
        // send() waits for mining by default and returns { receipt, ... }
        const fromAddress = AztecAddress.fromString(from);
        const result = await contract.methods[functionName](...(args as never[])).send({ from: fromAddress });

        onStep?.("submitting");
        onStep?.("confirmed");
        return (result as { receipt: { txHash: { toString(): string } } }).receipt.txHash.toString();
      } catch (err) {
        if (abortRef.current?.signal.aborted) {
          throw new Error("Proof generation cancelled");
        }
        throw err;
      }
    },
    [wallet],
  );

  const cancelProof = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { health, checkHealth, getPrivateNotes, simulateAndProve, cancelProof };
}
