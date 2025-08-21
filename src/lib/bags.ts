// src/lib/bags.ts

// Small helper to parse text->JSON with a safe fallback
async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

export async function bagsPing(): Promise<{ message: string } | any> {
  const res = await fetch('/api/bags-proxy?path=/ping', {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Ping failed: ${res.status}`);
  return parseJsonSafe(res);
}

/**
 * Step 1: Create Token Info (uploads image + metadata)
 */
export async function bagsCreateTokenInfo(fields: {
  name: string;
  symbol: string;
  description?: string;
  telegram?: string;
  twitter?: string;
  website?: string;
  imageFile: File;
}) {
  const form = new FormData();
  form.append('name', fields.name);
  form.append('symbol', fields.symbol);
  if (fields.description) form.append('description', fields.description);
  if (fields.telegram) form.append('telegram', fields.telegram);
  if (fields.twitter) form.append('twitter', fields.twitter);
  if (fields.website) form.append('website', fields.website);
  form.append('image', fields.imageFile);

  const res = await fetch('/api/bags-proxy?path=/token-launch/create-token-info', {
    method: 'POST',
    body: form,
  });

  const body = await parseJsonSafe(res);
  if (!res.ok || body?.success === false) {
    throw new Error(`create-token-info failed: ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Step 1.5: Create Launch Config (required to get configKey)
 * Returns { tx: "<base64>", configKey: "<string>" }
 */
export async function bagsCreateLaunchConfig(payload: {
  launchWallet: string;  // creator wallet (base58)
}) {
  const res = await fetch('/api/bags-proxy?path=/token-launch/create-config', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok || body?.success === false) {
    throw new Error(`create-config failed: ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Step 2: Create Launch Transaction
 */
export async function bagsCreateLaunch(payload: {
  ipfs: string;
  tokenMint: string;
  wallet: string;
  initialBuyLamports?: number;
  configKey?: string; // now required
}) {
  const res = await fetch('/api/bags-proxy?path=/token-launch/create-launch-transaction', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonSafe(res);
  if (!res.ok || body?.success === false) {
    throw new Error(`create-launch-transaction failed: ${JSON.stringify(body)}`);
  }
  return body;
}
