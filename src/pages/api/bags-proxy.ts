import type { NextApiRequest, NextApiResponse } from 'next';

const BASE = process.env.BAGS_API_BASE || 'https://public-api-v2.bags.fm/api/v1';
const KEY = process.env.BAGS_API_KEY;

export const config = {
  api: {
    bodyParser: false, // we handle form-data manually
  },
};

function parseBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const path = (req.query.path as string) || '/ping';
    const url = `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers: Record<string, string> = {};
    if (KEY) {
      headers['x-api-key'] = KEY;
    }

    // forward content-type if present (for form-data & json)
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'] as string;
    }

    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await parseBody(req);
    }

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    const text = await upstream.text();
    res.status(upstream.status).send(text);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'proxy-error' });
  }
}
