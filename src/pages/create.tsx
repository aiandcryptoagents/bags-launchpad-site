"use client";
import React, { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";
import {
  bagsCreateTokenInfo,
  bagsCreateLaunch,
  bagsCreateLaunchConfig,
} from "@/lib/bags";

// ---------------- Helpers ----------------
const isLikelyBase58 = (s: string) => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s.trim());
const normB64 = (s?: string) => {
  if (!s) return s;
  let t = s.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  t = t.replace(/\s+/g, "");
  while (t.length % 4) t += "=";
  return t;
};
const B58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < B58_ALPHABET.length; i++) m[B58_ALPHABET[i]] = i;
  return m;
})();
function decodeBase58(str: string): Uint8Array {
  let n = 0n;
  for (let i = 0; i < str.length; i++) {
    const v = B58_MAP[str[i]];
    if (v === undefined) throw new Error("Invalid base58 character");
    n = n * 58n + BigInt(v);
  }
  let bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n % 256n));
    n = n / 256n;
  }
  bytes = bytes.reverse();
  let leading = 0;
  for (let i = 0; i < str.length && str[i] === "1"; i++) leading++;
  if (leading > 0) bytes = new Array(leading).fill(0).concat(bytes);
  return new Uint8Array(bytes);
}
function pickTxString(anyResp: any): string | undefined {
  const r = anyResp?.response ?? anyResp?.data ?? anyResp;
  if (typeof r === "string") return r;
  const candidates = [
    r?.transactionBase64,
    r?.transaction,
    r?.txBase64,
    r?.tx,
    r?.serializedTx,
    r?.serialized,
  ];
  if (!candidates.some(Boolean) && r && typeof r === "object") {
    for (const k of Object.keys(r)) {
      const v = (r as any)[k];
      if (typeof v === "string" && v.length > 100) return v;
    }
  }
  return candidates.find(Boolean);
}
function decodeTxStringSync(s: string): Uint8Array {
  if (isLikelyBase58(s)) return decodeBase58(s);
  const b64 = normB64(s)!;
  return Buffer.from(b64, "base64");
}
async function buildSignable(
  raw: Uint8Array
): Promise<{ type: "versioned" | "legacy"; tx: any }> {
  const web3 = await import("@solana/web3.js");
  try {
    // @ts-ignore
    const vtx = web3.VersionedTransaction.deserialize(raw);
    return { type: "versioned", tx: vtx };
  } catch {
    try {
      // @ts-ignore
      const msg = web3.VersionedMessage.deserialize(raw);
      const vtx = new web3.VersionedTransaction(msg);
      return { type: "versioned", tx: vtx };
    } catch {
      const ltx = web3.Transaction.from(raw);
      return { type: "legacy", tx: ltx };
    }
  }
}
const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet").toLowerCase();
const makeExplorerTxUrl = (sig: string) =>
  cluster === "mainnet-beta"
    ? `https://explorer.solana.com/tx/${sig}`
    : `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;

// ---------------- Component ----------------
export default function Create() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [ipfs, setIpfs] = useState<string | null>(null);
  const [configKey, setConfigKey] = useState<string | null>(null);

  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);

  // STEP 1: Create Token Info
  const onCreateTokenInfo = useCallback(async () => {
    if (!file) return setStatus("❌ Choose an image (≤15MB).");
    if (!name || !symbol) return setStatus("❌ Name and symbol required.");

    setStatus("Uploading metadata…");
    try {
      const res = await bagsCreateTokenInfo({
        name,
        symbol,
        description,
        imageFile: file,
      });
      const resp = res?.response ?? res?.data ?? res;
      const mint = resp?.tokenMint;
      const uri = resp?.tokenLaunch?.uri || resp?.tokenMetadata;
      if (!mint || !uri) throw new Error("Unexpected Bags response");
      setTokenMint(mint);
      setIpfs(uri);
      setStatus(`✅ Token info created. Mint: ${mint}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [file, name, symbol, description]);

  // STEP 2: Launch
  const onCreateLaunchTx = useCallback(async () => {
    if (!connected || !publicKey) return setStatus("Connect your wallet first.");
    if (!tokenMint || !ipfs) return setStatus("Upload token info first.");

    setCreating(true);
    try {
      setStatus("Getting config key…");
      let key = configKey;
      if (!key) {
        const cfg = await bagsCreateLaunchConfig({
          launchWallet: publicKey.toBase58(),
        });
        key =
          cfg?.response?.configKey ||
          cfg?.response?.key ||
          cfg?.configKey ||
          cfg?.key;
        if (!key) throw new Error("❌ Config key missing in Bags response");
        setConfigKey(key);
      }

      setStatus("Requesting launch transaction…");
      const resp = await bagsCreateLaunch({
        ipfs,
        tokenMint,
        wallet: publicKey.toBase58(),
        initialBuyLamports: 0,
        configKey: key,
      });

      const txStr = pickTxString(resp);
      if (!txStr) throw new Error("No transaction in response.");
      const raw = decodeTxStringSync(txStr);
      const { tx } = await buildSignable(raw);

      const latest = await connection.getLatestBlockhash();
      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );

      setStatus(`🎉 Launched! View: ${makeExplorerTxUrl(sig)}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }, [connected, publicKey, tokenMint, ipfs, configKey, connection, sendTransaction]);

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-12">
      <div className="max-w-2xl mx-auto bg-gray-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-6">🚀 Create Your MemeCoin</h1>

        {/* Upload */}
        <label className="block mb-4">
          <span className="text-gray-300">Upload Logo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-purple-600 file:text-white
              hover:file:bg-purple-700"
          />
        </label>

        {/* Inputs */}
        <input
          className="w-full mb-3 p-3 rounded bg-gray-700 text-white placeholder-gray-400"
          placeholder="Token Name (e.g. Doge Elon)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full mb-3 p-3 rounded bg-gray-700 text-white placeholder-gray-400"
          placeholder="Symbol (e.g. DOGE)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        />
        <textarea
          className="w-full mb-3 p-3 rounded bg-gray-700 text-white placeholder-gray-400"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Actions */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={onCreateTokenInfo}
            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
          >
            1️⃣ Create Token Info
          </button>
          <button
            onClick={onCreateLaunchTx}
            disabled={!tokenMint || !ipfs || creating}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-semibold"
          >
            2️⃣ Launch Token
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className="p-3 bg-gray-900 rounded-lg text-sm whitespace-pre-wrap">
            {status}
          </div>
        )}

        {/* Preview */}
        {file && (
          <div className="mt-4 flex items-center gap-4">
            <img
              src={URL.createObjectURL(file)}
              alt="preview"
              className="w-20 h-20 rounded-lg border border-gray-700"
            />
            <div>
              <p className="font-semibold">{name || "Unnamed Coin"}</p>
              <p className="opacity-70">{symbol}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
