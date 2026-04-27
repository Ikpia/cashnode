"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatWalletAddress, getBrowserWalletProvider } from "@/lib/solana-wallet";

type WalletStatus = "idle" | "connecting" | "connected" | "unsupported" | "error";

type WalletContextValue = {
  status: WalletStatus;
  publicKey: string | null;
  shortAddress: string;
  hasProvider: boolean;
  helperText: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const walletStorageKey = "cashnode_connected_wallet";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [helperText, setHelperText] = useState("");
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    const provider = getBrowserWalletProvider();
    setHasProvider(Boolean(provider));

    if (!provider) {
      return;
    }

    const handleConnect = () => {
      const nextAddress = provider.publicKey?.toString() ?? null;
      setPublicKey(nextAddress);
      setStatus(nextAddress ? "connected" : "idle");
      setHelperText(nextAddress ? "Wallet connected." : "");

      if (nextAddress) {
        window.localStorage.setItem(walletStorageKey, nextAddress);
      }
    };

    const handleDisconnect = () => {
      setPublicKey(null);
      setStatus("idle");
      setHelperText("Wallet disconnected.");
      window.localStorage.removeItem(walletStorageKey);
    };

    provider.on?.("connect", handleConnect);
    provider.on?.("disconnect", handleDisconnect);
    provider.on?.("accountChanged", handleConnect);

    const trustedWallet = window.localStorage.getItem(walletStorageKey);

    if (trustedWallet) {
      void provider
        .connect({ onlyIfTrusted: true })
        .then(() => {
          const nextAddress = provider.publicKey?.toString() ?? trustedWallet;
          setPublicKey(nextAddress);
          setStatus(nextAddress ? "connected" : "idle");
          setHelperText(nextAddress ? "Wallet connected." : "");
        })
        .catch(() => {
          window.localStorage.removeItem(walletStorageKey);
          setStatus("idle");
        });
    }

    return () => {
      provider.off?.("connect", handleConnect);
      provider.off?.("disconnect", handleDisconnect);
      provider.off?.("accountChanged", handleConnect);
    };
  }, []);

  const connectWallet = async () => {
    const provider = getBrowserWalletProvider();

    if (!provider) {
      setHasProvider(false);
      setStatus("unsupported");
      setHelperText("Phantom was not found. Install it to connect your wallet.");
      window.open("https://phantom.app/download", "_blank", "noopener,noreferrer");
      return;
    }

    setHasProvider(true);
    setStatus("connecting");
    setHelperText("Waiting for wallet approval...");

    try {
      const response = await provider.connect();
      const nextAddress = response.publicKey?.toString() ?? provider.publicKey?.toString() ?? null;

      if (!nextAddress) {
        throw new Error("Wallet connected but no public key was returned.");
      }

      setPublicKey(nextAddress);
      setStatus("connected");
      setHelperText("Wallet connected.");
      window.localStorage.setItem(walletStorageKey, nextAddress);
    } catch (error) {
      setStatus("error");
      setHelperText(error instanceof Error ? error.message : "Unable to connect wallet.");
    }
  };

  const disconnectWallet = async () => {
    const provider = getBrowserWalletProvider();

    if (!provider) {
      setPublicKey(null);
      setStatus("idle");
      setHelperText("");
      window.localStorage.removeItem(walletStorageKey);
      return;
    }

    try {
      await provider.disconnect();
    } catch {
      // fall through to local cleanup so the UI is not stuck in a connected state
    }

    setPublicKey(null);
    setStatus("idle");
    setHelperText("Wallet disconnected.");
    window.localStorage.removeItem(walletStorageKey);
  };

  const value = useMemo(
    () => ({
      status,
      publicKey,
      shortAddress: formatWalletAddress(publicKey),
      hasProvider,
      helperText,
      connectWallet,
      disconnectWallet
    }),
    [status, publicKey, hasProvider, helperText]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider.");
  }

  return context;
}
