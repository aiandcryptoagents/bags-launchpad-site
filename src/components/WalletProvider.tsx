// src/components/WalletProvider.tsx
import React, { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SAWalletProvider,
} from '@solana/wallet-adapter-react';
import {
  WalletModalProvider,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, Cluster } from '@solana/web3.js';

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read env
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';


  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SAWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 700 }}>
              Bags Launchpad
              <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, opacity: 0.7 }}>
              </span>
            </div>
            <WalletMultiButton />
          </div>
          <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }}>
            {children}
          </div>
        </WalletModalProvider>
      </SAWalletProvider>
    </ConnectionProvider>
  );
};
