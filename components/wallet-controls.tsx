"use client";

import { useWallet } from "@/components/wallet-provider";

export function WalletControls({ showAvatar = false }: { showAvatar?: boolean }) {
  const { status, shortAddress, helperText, connectWallet, disconnectWallet, publicKey } = useWallet();

  const buttonLabel =
    status === "connecting"
      ? "Connecting..."
      : status === "connected" && shortAddress
        ? shortAddress
        : status === "unsupported"
          ? "Install Phantom"
          : "Connect Wallet";

  const handleClick = async () => {
    if (status === "connected" && publicKey) {
      await disconnectWallet();
      return;
    }

    await connectWallet();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleClick()}
          className={`rounded-full px-6 py-2.5 text-sm font-semibold shadow-md transition-opacity hover:opacity-90 ${
            status === "connected" ? "border border-primary/15 bg-white text-primary" : "bg-primary text-white"
          }`}
          title={status === "connected" ? "Click to disconnect wallet" : "Connect Solana wallet"}
        >
          {buttonLabel}
        </button>

        {showAvatar ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-sm font-semibold text-stone-700">
            {shortAddress ? shortAddress.slice(0, 1) : "C"}
          </div>
        ) : null}
      </div>

      {helperText ? (
        <span className={`text-[11px] ${status === "error" ? "text-[#b42318]" : "text-stone-500"}`}>{helperText}</span>
      ) : null}
    </div>
  );
}
