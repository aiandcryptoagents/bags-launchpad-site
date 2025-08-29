export {};

declare global {
  interface Window {
    Jupiter: {
      init: (opts: any) => Promise<{
        destroy: () => void;
        close: () => void;
        open: () => void;
      }>;
    };
  }
}