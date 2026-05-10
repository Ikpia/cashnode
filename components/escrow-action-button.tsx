"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet-provider";
import { authFetch } from "@/lib/client-auth";

type EscrowActionButtonProps = {
  requestId: string;
  action: "cancel";
  children: string;
  className?: string;
};

function getActionLabel(action: EscrowActionButtonProps["action"]) {
  switch (action) {
    case "cancel":
      return "Cancel escrow";
  }
}

export function EscrowActionButton({ requestId, action, children, className = "" }: EscrowActionButtonProps) {
  const router = useRouter();
  const { publicKey, connectWallet, signAndSendTransaction } = useWallet();
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  const runAction = async () => {
    setIsWorking(true);
    setMessage("");

    try {
      const walletAddress = publicKey || (await connectWallet());

      if (!walletAddress) {
        throw new Error("Connect your Solana wallet first.");
      }

      const transactionResponse = await authFetch(`/api/payout-requests/${requestId}/escrow/transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          walletAddress
        })
      });
      const transactionPayload = await transactionResponse.json();

      if (!transactionResponse.ok) {
        throw new Error(transactionPayload.error ?? `Unable to prepare ${getActionLabel(action)} transaction.`);
      }

      const signature = await signAndSendTransaction(
        transactionPayload.transaction.transactionBase64,
        transactionPayload.transaction.rpcUrl
      );

      if (!signature) {
        throw new Error("Wallet did not return a transaction signature.");
      }

      const recordResponse = await authFetch(`/api/payout-requests/${requestId}/escrow/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          signature,
          walletAddress,
          escrowAddress: transactionPayload.transaction.escrowAddress,
          referenceSeed: transactionPayload.transaction.referenceSeedHex
        })
      });
      const recordPayload = await recordResponse.json();

      if (!recordResponse.ok) {
        throw new Error(recordPayload.error ?? `Unable to record ${getActionLabel(action)} transaction.`);
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to ${children.toLowerCase()} this request.`);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={isWorking}
        onClick={() => void runAction()}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {isWorking ? "Waiting..." : children}
      </button>
      {message ? <span className="max-w-[14rem] text-xs font-medium text-[#b42318]">{message}</span> : null}
    </span>
  );
}
