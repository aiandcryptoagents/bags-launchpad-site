import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SAWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'https://api.devnet.solana.com';
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SAWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div style={{ padding: '12px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700 }}>Bags Launchpad</div>
            <WalletMultiButton />
          </div>
          <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }}>{children}</div>
        </WalletModalProvider>
      </SAWalletProvider>
    </ConnectionProvider>
  );
};
