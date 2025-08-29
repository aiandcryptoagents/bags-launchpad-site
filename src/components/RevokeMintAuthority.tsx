"use client";
import React, { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
} from "@solana/web3.js";

type Props = {
  mint?: string; // optional prop to override env
};

export default function RevokeMintAuthority({ mint }: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [status, setStatus] = useState("");

  const tokenMint = mint || process.env.NEXT_PUBLIC_TOKEN_MINT!;

  const revoke = async () => {
    if (!connected || !publicKey) {
      return setStatus("⚠️ Connect wallet first.");
    }
    try {
      setStatus("Submitting revoke transaction…");

      const mintPk = new PublicKey(tokenMint);

      // Build instruction
      const ix = createSetAuthorityInstruction(
        mintPk,             // token mint account
        publicKey,          // current authority (your wallet)
        AuthorityType.MintTokens,
        null                // new authority = null (revoke)
      );

      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;

      // Fetch blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = blockhash;

      // Send + confirm
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setStatus(`✅ Mint authority revoked. Tx: https://explorer.solana.com/tx/${sig}?cluster=mainnet-beta`);
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Error: ${e.message}`);
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-white shadow-md">
      <h2 className="font-bold mb-2 text-lg">🛠 Owner Tool</h2>
      <p className="text-sm opacity-70 mb-3">
        Revoke mint authority to lock supply forever (irreversible).
      </p>
      <button
        onClick={revoke}
        disabled={!connected}
        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
      >
        Revoke Mint Authority
      </button>
      {status && (
        <p className="text-xs mt-3 font-mono break-all">{status}</p>
      )}
    </div>
  );
}
