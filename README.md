# Bags Launchpad (Next.js + Solana Wallet Adapter)

This is a minimal site scaffold that talks to the Bags.fm public API through a server-side proxy route.

## Quick start
1. `cp .env.local.example .env.local` and set `BAGS_API_KEY`.
2. `npm i`
3. `npm run dev`
4. Visit http://localhost:3000 and run the `/ping` health check.

## Structure
- `src/pages/index.tsx`: Home with `/ping` button
- `src/pages/create.tsx`: Create Token (name/symbol/desc + image upload)
- `src/pages/api/bags-proxy.ts`: Server route that forwards to Bags (`/ping`, `/upload`, etc.) with your API key
- `src/components/WalletProvider.tsx`: Solana wallet context + connect button
- `src/lib/bags.ts`: Lightweight client for the proxy

## Next steps
- Wire the **Create Launch Transaction** endpoint after file upload
- Render token page `/token/[mint]` with live curve + buy action
