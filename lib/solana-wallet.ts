export type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: {
    toString(): string;
  } | null;
  connect(options?: {
    onlyIfTrusted?: boolean;
  }): Promise<{
    publicKey?: {
      toString(): string;
    } | null;
  }>;
  disconnect(): Promise<void>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    phantom?: {
      solana?: SolanaProvider;
    };
    solana?: SolanaProvider;
  }
}

export function getBrowserWalletProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.phantom?.solana) {
    return window.phantom.solana;
  }

  if (window.solana) {
    return window.solana;
  }

  return null;
}

export function formatWalletAddress(address: string | null) {
  if (!address) {
    return "";
  }

  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
