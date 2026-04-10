// ---------------------------------------------------------------------------
// usePXE — PXE integration, private state access, proof generation coordination
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from "react";
import { aztecConfig } from "../config/aztec";

interface PxeHealth {
  ok: boolean;
  blockNumber: number | null;
  error: string | null;
}

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(aztecConfig.pxeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "PXE RPC error");
  return json.result;
}

export function usePXE() {
  const [health, setHealth] = useState<PxeHealth>({ ok: false, blockNumber: null, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const info = (await rpc("pxe_getNodeInfo")) as { blockNumber?: number };
      setHealth({ ok: true, blockNumber: info.blockNumber ?? null, error: null });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setHealth({ ok: false, blockNumber: null, error: msg });
      return false;
    }
  }, []);

  const getPrivateNotes = useCallback(async (owner: string, contractAddress: string) => {
    return (await rpc("pxe_getNotes", [{ owner, contractAddress }])) as unknown[];
  }, []);

  const simulateAndProve = useCallback(
    async (
      contractAddress: string,
      functionName: string,
      args: unknown[],
      from: string,
      onStep?: (step: string) => void,
    ) => {
      abortRef.current = new AbortController();
      onStep?.("witness");

      // Simulate
      const simResult = await rpc("pxe_simulateTx", [
        { to: contractAddress, functionName, args, from },
      ]);
      onStep?.("proving");

      // Prove
      const proveTx = await rpc("pxe_proveTx", [simResult]);
      onStep?.("submitting");

      // Send
      const txHash = await rpc("pxe_sendTx", [proveTx]);
      onStep?.("confirmed");
      return txHash as string;
    },
    [],
  );

  const cancelProof = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { health, checkHealth, getPrivateNotes, simulateAndProve, cancelProof, rpc };
}
