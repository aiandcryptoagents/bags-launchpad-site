"use client";
import React, { useEffect, useRef } from "react";

// Types for Jupiter instance
interface JupiterInstance {
  destroy: () => void;
  open: () => void;
  close: () => void;
}

export default function JupiterTerminal() {
  const termRef = useRef<JupiterInstance | null>(null);

  const outputMint = process.env.NEXT_PUBLIC_TOKEN_MINT!;
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // dynamically import to avoid SSR crash
        await import("@jup-ag/terminal");

        const inst = await (window as any).Jupiter.init({
          endpoint: rpcUrl,
          displayMode: "integrated", // or "modal"
          integratedTargetId: "jup-container",
          defaultInputMint: "So11111111111111111111111111111111111111112", // SOL
          defaultOutputMint: outputMint,
          formProps: { slippageBps: 100 }, // 1% slippage
          enableWalletPassthrough: true,
          containerStyles: { height: 620 },
          cluster,
          onSwapSuccess: (txid: string) =>
            console.log("[Jupiter] swap success", txid),
          onSwapError: (err: unknown) =>
            console.error("[Jupiter] swap error", err),
        });

        if (!mounted) inst.destroy();
        else termRef.current = inst;
      } catch (e) {
        console.error("Jupiter init failed", e);
      }
    })();

    return () => {
      mounted = false;
      if (termRef.current) termRef.current.destroy();
    };
  }, [rpcUrl, outputMint, cluster]);

  return (
    <div className="border rounded-xl p-3">
      <h2 className="font-semibold mb-2">Buy / Swap</h2>
      <div id="jup-container" style={{ width: "100%", height: 620 }} />
    </div>
  );
}
