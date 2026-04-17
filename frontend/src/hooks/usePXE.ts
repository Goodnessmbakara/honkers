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
import { Fr } from "@aztec/aztec.js/fields";
import type { NotesFilter } from "@aztec/pxe/server";
import { NoteStatus } from "@aztec/stdlib/note";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import type { MinimalWallet } from "../utils/MinimalWallet";

interface PxeHealth {
  ok: boolean;
  blockNumber: number | null;
  error: string | null;
}

/** Cached Sponsored FPC setup — registered once per wallet instance */
let sponsoredFPCPromise: Promise<SponsoredFeePaymentMethod> | null = null;
let sponsoredFPCWallet: unknown = null; // track which wallet instance we registered for

async function getSponsoredFPC(wallet: MinimalWallet): Promise<SponsoredFeePaymentMethod> {
  if (sponsoredFPCPromise && sponsoredFPCWallet === wallet) return sponsoredFPCPromise;
  sponsoredFPCWallet = wallet;
  sponsoredFPCPromise = (async () => {
    const { SponsoredFPCContractArtifact } = await import("@aztec/noir-contracts.js/SponsoredFPC");
    const instance = await getContractInstanceFromInstantiationParams(
      SponsoredFPCContractArtifact,
      { salt: Fr.ZERO },
    );
    await wallet.registerContract(instance, SponsoredFPCContractArtifact);
    return new SponsoredFeePaymentMethod(instance.address);
  })();
  sponsoredFPCPromise.catch(() => { sponsoredFPCPromise = null; });
  return sponsoredFPCPromise;
}

/** Raw note fields decoded from PXE (PrivateSet note preimage). */
export type PrivateNotePayload = { items: bigint[] };

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
    async (owner: string, contractAddress: string, storageSlot: number): Promise<PrivateNotePayload[]> => {
      if (!pxeInstance?.pxe) return [];
      const pxe = pxeInstance.pxe;
      const ownerAddr = AztecAddress.fromString(owner);
      const contractAddr = AztecAddress.fromString(contractAddress);
      const filter: NotesFilter = {
        contractAddress: contractAddr,
        owner: ownerAddr,
        storageSlot: new Fr(BigInt(storageSlot)),
        status: NoteStatus.ACTIVE,
        scopes: [ownerAddr],
      };
      try {
        const rows = await pxe.debug.getNotes(filter);
        return rows.map((r) => ({
          items: r.note.items.map((f) => f.toBigInt()),
        }));
      } catch (err) {
        console.warn("[usePXE] getPrivateNotes failed:", err);
        return [];
      }
    },
    [pxeInstance],
  );

  /** Simulate a public/utility view function (no tx, no proof). */
  const simulateView = useCallback(
    async (contractAddress: string, functionName: string, args: unknown[]) => {
      if (!wallet) throw new Error("Wallet not initialized. Wait for AztecProvider to load.");
      const artifact = getArtifact(contractAddress);
      const address = AztecAddress.fromString(contractAddress);
      const contract = Contract.at(address, artifact, wallet);
      const fn = contract.methods[functionName] as (...a: unknown[]) => { simulate: () => Promise<unknown> };
      return fn(...args).simulate();
    },
    [wallet],
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

        // Set up Sponsored FPC so the user doesn't need Fee Juice balance
        const paymentMethod = await getSponsoredFPC(wallet);
        const fromAddress = AztecAddress.fromString(from);
        const result = await contract.methods[functionName](...(args as never[])).send({
          from: fromAddress,
          fee: { paymentMethod },
        });

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

  return { health, checkHealth, getPrivateNotes, simulateView, simulateAndProve, cancelProof };
}
