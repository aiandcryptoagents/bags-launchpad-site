"use client";
import React, { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  bagsCreateTokenInfo,
  bagsCreateLaunch,
  bagsCreateLaunchConfig,
} from "@/lib/bags";
import { Buffer } from "buffer";

// --------------------------------------------
export default function Create() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [status, setStatus] = useState("");
  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [ipfs, setIpfs] = useState<string | null>(null);

  // STEP 1: create metadata
  const onCreateTokenInfo = useCallback(async () => {
    if (!file) return setStatus("Please select an image.");
    if (!name || !symbol) return setStatus("Name and symbol required.");

    setStatus("Uploading metadata...");
    try {
      const res = await bagsCreateTokenInfo({
        name,
        symbol,
        description,
        imageFile: file,
      });
      const resp = res?.response ?? res;
      setTokenMint(resp?.tokenMint);
      setIpfs(resp?.tokenMetadata);
      setStatus("✅ Token metadata uploaded");
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [file, name, symbol, description]);

  // STEP 2: launch
  const onLaunch = useCallback(async () => {
    if (!connected || !publicKey) return setStatus("Connect wallet first.");
    if (!tokenMint || !ipfs) return setStatus("Upload token info first.");

    setStatus("Launching...");
    try {
      const resp = await bagsCreateLaunch({
        ipfs,
        tokenMint,
        wallet: publicKey.toBase58(),
        initialBuyLamports: 0,
        configKey: "auto", // simplified
      });
      setStatus(`🚀 Launched! Tx: ${JSON.stringify(resp)}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [connected, publicKey, tokenMint, ipfs]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex justify-center p-6">
      <div className="w-full max-w-6xl grid md:grid-cols-3 gap-8">
        {/* LEFT FORM */}
        <div className="md:col-span-2 space-y-6">
          <h1 className="text-3xl font-bold">Create new coin</h1>
          <p className="text-gray-400">Fill in details to launch your token</p>

          {/* Coin details */}
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                className="p-3 rounded-lg bg-gray-700 w-full outline-none"
                placeholder="Coin name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="p-3 rounded-lg bg-gray-700 w-full outline-none"
                placeholder="Ticker (e.g. DOGE)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>

            <textarea
              className="p-3 rounded-lg bg-gray-700 w-full outline-none"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* File upload */}
            <div className="border-2 border-dashed border-gray-600 p-8 rounded-xl text-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="fileUpload"
              />
              <label
                htmlFor="fileUpload"
                className="cursor-pointer text-gray-300"
              >
                {file ? file.name : "Click to upload an image"}
              </label>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onCreateTokenInfo}
                className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-500"
              >
                1) Upload Info
              </button>
              <button
                onClick={onLaunch}
                className="bg-green-600 px-4 py-2 rounded-lg hover:bg-green-500"
              >
                2) Launch
              </button>
            </div>
            {status && <p className="text-sm text-gray-400">{status}</p>}
          </div>
        </div>

        {/* PREVIEW */}
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center">
          {file ? (
            <img
              src={URL.createObjectURL(file)}
              alt="preview"
              className="rounded-xl w-40 h-40 object-cover"
            />
          ) : (
            <p className="text-gray-500">Preview of your coin</p>
          )}
          {name && <h2 className="mt-4 font-bold">{name}</h2>}
          {symbol && <p className="text-gray-400">${symbol}</p>}
        </div>
      </div>
    </div>
  );
}
