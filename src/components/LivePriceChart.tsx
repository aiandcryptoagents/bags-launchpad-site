"use client";
import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  mint?: string;
  cluster?: string; // reserved if later you want to fetch from different Solana clusters
};

// Simple fetcher to get latest price from Jupiter price API
async function fetchPrice(mint: string) {
  const url = `https://price.jup.ag/v6/price?ids=${mint}`;
  const res = await fetch(url);
  const data = await res.json();
  return data?.data?.[mint]?.price ?? null;
}

export default function LivePriceChart({ mint, cluster }: Props) {
  const tokenMint = mint || process.env.NEXT_PUBLIC_TOKEN_MINT!;
  const [prices, setPrices] = useState<{ time: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenMint) return;

    const interval = setInterval(async () => {
      try {
        const p = await fetchPrice(tokenMint);
        if (p) {
          setPrices((old) => [
            ...old.slice(-20), // keep last 20 points
            { time: new Date().toLocaleTimeString(), price: p },
          ]);
          setLoading(false);
        }
      } catch (e) {
        console.error("price fetch failed", e);
      }
    }, 5000); // poll every 5s

    return () => clearInterval(interval);
  }, [tokenMint]);

  return (
    <div className="border rounded-xl p-4 bg-white shadow-md">
      <h2 className="font-bold mb-3 text-lg">📈 Live Price</h2>
      {loading ? (
        <p className="text-sm opacity-60">Waiting for price data…</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={prices}>
            <XAxis dataKey="time" hide />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#6366f1" // indigo-500
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-2 text-xs text-gray-500">
        Mint: <span className="font-mono">{tokenMint}</span>
      </p>
    </div>
  );
}
