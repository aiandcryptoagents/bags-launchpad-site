import { useState } from 'react';
import useSWR from 'swr';
import { bagsPing } from '@/lib/bags';
import Link from 'next/link';

export default function Home() {
  const [pingResult, setPingResult] = useState<string>('');

  const doPing = async () => {
    try {
      const res = await bagsPing();
      setPingResult(JSON.stringify(res));
    } catch (e: any) {
      setPingResult(e.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Bags Launchpad</h1>
      <p className="mt-2">Starter site wired to the Bags.fm public API via a server proxy.</p>
      <div className="mt-6 flex items-center gap-4">
        <button onClick={doPing} className="px-4 py-2 border rounded">Test /ping</button>
        <Link href="/create" className="px-4 py-2 border rounded">Create Token</Link>
      </div>
      {pingResult && (
        <pre className="mt-4 p-3 bg-gray-100 rounded text-sm overflow-auto">{pingResult}</pre>
      )}
    </div>
  );
}
