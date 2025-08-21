import React, { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer';
import {
  bagsCreateTokenInfo,
  bagsCreateLaunch,
  bagsCreateLaunchConfig,
} from '@/lib/bags';

// --------- helpers ---------

// likely base58 (no 0,O,I,l and no +/=)
const isLikelyBase58 = (s: string) => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s.trim());

// normalize base64url and pad
const normB64 = (s?: string) => {
  if (!s) return s;
  let t = s.trim().replace(/-/g, '+').replace(/_/g, '/');
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  t = t.replace(/\s+/g, '');
  while (t.length % 4) t += '=';
  return t;
};

// Minimal Base58 decoder (Bitcoin alphabet)
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < B58_ALPHABET.length; i++) m[B58_ALPHABET[i]] = i;
  return m;
})();

function decodeBase58(str: string): Uint8Array {
  let n = 0n;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const v = B58_MAP[ch];
    if (v === undefined) throw new Error('Invalid base58 character');
    n = n * 58n + BigInt(v);
  }
  // convert BigInt to bytes (big-endian)
  let bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n % 256n));
    n = n / 256n;
  }
  bytes = bytes.reverse();
  // handle leading zeros: each leading '1' adds a 0x00
  let leading = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) leading++;
  if (leading > 0) bytes = new Array(leading).fill(0).concat(bytes);
  return new Uint8Array(bytes);
}

// attempt to find a tx-like string across many shapes
function pickTxString(anyResp: any): string | undefined {
  const r = anyResp?.response ?? anyResp?.data ?? anyResp;
  if (typeof r === 'string') return r;

  const candidates = [
    r?.transactionBase64,
    r?.transaction,
    r?.txBase64,
    r?.tx,            // often used for config
    r?.serializedTx,
    r?.serialized,
  ];

  if (!candidates.some(Boolean) && r && typeof r === 'object') {
    for (const k of Object.keys(r)) {
      const v = (r as any)[k];
      if (typeof v === 'string' && v.length > 100) return v;
    }
  }
  return candidates.find(Boolean);
}

// decode tx string that might be base58 or base64
function decodeTxStringSync(s: string): Uint8Array {
  if (isLikelyBase58(s)) return decodeBase58(s);
  const b64 = normB64(s)!;
  return Buffer.from(b64, 'base64');
}

// Build a signable object for the wallet (prefers sendTransaction)
async function buildSignable(
  raw: Uint8Array
): Promise<{ type: 'versioned' | 'legacy'; tx: any }> {
  const web3 = await import('@solana/web3.js');
  // Try VersionedTransaction
  try {
    // @ts-ignore
    const vtx = web3.VersionedTransaction.deserialize(raw);
    return { type: 'versioned', tx: vtx };
  } catch (_) {
    // Try VersionedMessage -> VersionedTransaction
    try {
      // @ts-ignore
      const msg = web3.VersionedMessage.deserialize(raw);
      const vtx = new web3.VersionedTransaction(msg);
      return { type: 'versioned', tx: vtx };
    } catch (_) {
      // Legacy
      const ltx = web3.Transaction.from(raw);
      return { type: 'legacy', tx: ltx };
    }
  }
}

// --------------------------------------------

export default function Create() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  // Form
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // State from Bags steps
  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [ipfs, setIpfs] = useState<string | null>(null);
  const [configKey, setConfigKey] = useState<string | null>(null);

  // UI + debug
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [debugConfigResp, setDebugConfigResp] = useState<any>(null);
  const [debugLaunchResp, setDebugLaunchResp] = useState<any>(null);
  const [debugTxPreview, setDebugTxPreview] = useState<string | null>(null);
  const [debugTxLen, setDebugTxLen] = useState<number | null>(null);
  const [debugSimLogs, setDebugSimLogs] = useState<string[] | null>(null);

  // STEP 1: Create token info (uploads image + metadata -> returns mint + URI)
  const onCreateTokenInfo = useCallback(async () => {
    if (!file) return setStatus('Choose an image (≤15MB).');
    if (!name || !symbol) return setStatus('Name and symbol are required.');

    setStatus('Creating token info (uploading image)…');
    try {
      const res = await bagsCreateTokenInfo({ name, symbol, description, imageFile: file });
      const resp = res?.response ?? res?.data ?? res;
      const mint = resp?.tokenMint;
      const uri = resp?.tokenLaunch?.uri || resp?.tokenMetadata;
      if (!mint || !uri) throw new Error(`Unexpected response: ${JSON.stringify(res)}`);

      setTokenMint(mint);
      setIpfs(uri);
      setStatus(`Token info created ✅ Mint: ${mint}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message ?? String(e)}`);
    }
  }, [file, name, symbol, description]);

  // Ensure we have a configKey: create & sign the config tx if missing
  const ensureConfigKey = useCallback(async (): Promise<string> => {
    if (configKey) return configKey;
    if (!connected || !publicKey) throw new Error('Connect your wallet first.');

    setStatus('Creating launch config…');
    const cfg = await bagsCreateLaunchConfig({ launchWallet: publicKey.toBase58() });
    setDebugConfigResp(cfg);
    setDebugSimLogs(null);

    const resp = cfg?.response ?? cfg?.data ?? cfg;
    const txStr = pickTxString(resp);
    const key = resp?.configKey ?? resp?.key ?? resp?.config_key;
    if (!txStr || !key) throw new Error('Invalid config response (missing tx or configKey).');

    const raw = decodeTxStringSync(txStr);
    setDebugTxLen(raw.length);
    setDebugTxPreview(txStr.slice(0, 120));

    try {
      const { tx } = await buildSignable(raw);

      // Optional: simulate for clearer preflight errors (will often succeed or give logs)
      try {
        const sim = await connection.simulateTransaction(tx);
        if (sim?.value?.err) {
          setDebugSimLogs(sim?.value?.logs || null);
          throw new Error(`Simulation error before signing: ${JSON.stringify(sim.value.err)}`);
        }
      } catch (_) {
        // ignore - wallets may add signatures post-sim
      }

      // Send via wallet (sign + submit), then confirm with a blockhash snapshot
      const latest = await connection.getLatestBlockhash();
      const sig = await sendTransaction(tx, connection, { skipPreflight: false, maxRetries: 3 });

      try {
        await connection.confirmTransaction(
          { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
          'confirmed'
        );
      } catch {
        // quick retry with new snapshot if timing out
        const latest2 = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
          { signature: sig, blockhash: latest2.blockhash, lastValidBlockHeight: latest2.lastValidBlockHeight },
          'confirmed'
        );
      }

      setConfigKey(key);
      setStatus(`Launch config confirmed ✅ (${key}) — View: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      return key;
    } catch (e: any) {
      // try to capture logs for clarity
      try {
        const { tx } = await buildSignable(raw);
        const sim = await connection.simulateTransaction(tx);
        setDebugSimLogs(sim?.value?.logs || null);
      } catch {}
      throw new Error(`Config transaction could not be submitted: ${e.message ?? e}`);
    }
  }, [configKey, connected, publicKey, connection, sendTransaction]);

  // STEP 2: Create the launch transaction using mint + URI + configKey
  const onCreateLaunchTx = useCallback(async () => {
    if (!connected || !publicKey) return setStatus('Connect your wallet first.');
    if (!tokenMint || !ipfs) return setStatus('Create token info first.');

    setCreating(true);
    setDebugTxPreview(null);
    setDebugTxLen(null);
    setDebugSimLogs(null);
    try {
      const key = await ensureConfigKey();

      setStatus('Requesting launch transaction…');
      const resp = await bagsCreateLaunch({
        ipfs,
        tokenMint,
        wallet: publicKey.toBase58(),
        initialBuyLamports: 0,
        configKey: key,
      });

      setDebugLaunchResp(resp);

      const txStr = pickTxString(resp);
      if (!txStr) throw new Error('No transaction in response.');

      const raw = decodeTxStringSync(txStr);
      setDebugTxLen(raw.length);
      setDebugTxPreview(txStr.slice(0, 120));

      const { tx } = await buildSignable(raw);

      // Optional: simulate to catch errors early
      try {
        const sim = await connection.simulateTransaction(tx);
        if (sim?.value?.err) {
          setDebugSimLogs(sim?.value?.logs || null);
          throw new Error(`Simulation error before signing: ${JSON.stringify(sim.value.err)}`);
        }
      } catch (_) {}

      const latest = await connection.getLatestBlockhash();
      const sig = await sendTransaction(tx, connection, { skipPreflight: false, maxRetries: 3 });

      try {
        await connection.confirmTransaction(
          { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
          'confirmed'
        );
      } catch {
        const latest2 = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
          { signature: sig, blockhash: latest2.blockhash, lastValidBlockHeight: latest2.lastValidBlockHeight },
          'confirmed'
        );
      }

      setStatus(`Launched! Tx: ${sig} — View: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    } catch (e: any) {
      setStatus(`Error: ${e.message ?? String(e)}`);
    } finally {
      setCreating(false);
    }
  }, [connected, publicKey, tokenMint, ipfs, ensureConfigKey, connection, sendTransaction]);

  // ---------- UI ----------
  return (
    <div>
      <h1 className="text-xl font-bold">Create Token</h1>

      <div className="grid gap-3 mt-4">
        <input className="border p-2 rounded" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        <textarea className="border p-2 rounded" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

        <div className="flex gap-2">
          <button onClick={onCreateTokenInfo} className="px-4 py-2 border rounded">1) Create Token Info</button>
          <button onClick={onCreateLaunchTx} disabled={!tokenMint || !ipfs || creating} className="px-4 py-2 border rounded">2) Create Launch Tx</button>
        </div>
      </div>

      {status && <p className="mt-3 text-sm">{status}</p>}
      {tokenMint && <p className="mt-1 text-xs">Token Mint: {tokenMint}</p>}
      {ipfs && <p className="mt-1 text-xs">Metadata URI: {ipfs}</p>}
      {configKey && <p className="mt-1 text-xs">Config Key: {configKey}</p>}

      {/* Debug panel */}
      <div className="mt-6 p-3 border rounded bg-gray-50">
        <h2 className="font-semibold mb-2">Debug</h2>
        {debugTxLen != null && <div className="text-xs">Tx byte length: {debugTxLen}</div>}
        {debugTxPreview && (
          <div className="text-xs break-all">
            Tx preview (first 120 chars): <code>{debugTxPreview}</code>
          </div>
        )}
        {debugConfigResp && (
          <>
            <div className="text-xs mt-2 font-medium">Config response:</div>
            <pre className="text-xs overflow-auto bg-white p-2 rounded border">{JSON.stringify(debugConfigResp, null, 2)}</pre>
          </>
        )}
        {debugLaunchResp && (
          <>
            <div className="text-xs mt-2 font-medium">Launch response:</div>
            <pre className="text-xs overflow-auto bg-white p-2 rounded border">{JSON.stringify(debugLaunchResp, null, 2)}</pre>
          </>
        )}
        {debugSimLogs && (
          <>
            <div className="text-xs mt-2 font-medium">Simulation logs:</div>
            <pre className="text-xs overflow-auto bg-white p-2 rounded border">{JSON.stringify(debugSimLogs, null, 2)}</pre>
          </>
        )}
      </div>
    </div>
  );
}
