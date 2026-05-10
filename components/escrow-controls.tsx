"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWallet } from "@/components/wallet-provider";
import { authFetch } from "@/lib/client-auth";
import type { PayoutRequestRecord } from "@/lib/payout-requests";

type EscrowAction = "create" | "accept" | "mark_paid" | "complete" | "cancel";

type EscrowControlsProps = {
  request: PayoutRequestRecord;
  canCreate: boolean;
  canAccept: boolean;
  canMarkPaid: boolean;
  canComplete: boolean;
  canCancel: boolean;
};

function formatTokenUnits(units: number) {
  return `${units.toLocaleString("en-US")} token unit(s)`;
}

function getActionLabel(action: EscrowAction) {
  switch (action) {
    case "accept":
      return "Accept escrow";
    case "mark_paid":
      return "Mark escrow paid";
    case "complete":
      return "Settle escrow";
    case "cancel":
      return "Cancel escrow";
    default:
      return "Fund escrow";
  }
}

export function EscrowControls({ request, canCreate, canAccept, canMarkPaid, canComplete, canCancel }: EscrowControlsProps) {
  const router = useRouter();
  const { status, publicKey, connectWallet, signAndSendTransaction } = useWallet();
  const [message, setMessage] = useState("");
  const [activeAction, setActiveAction] = useState<EscrowAction | null>(null);

  const runEscrowAction = async (action: EscrowAction) => {
    setActiveAction(action);
    setMessage("");

    try {
      const walletAddress = publicKey || (await connectWallet());

      if (!walletAddress) {
        throw new Error("Wallet connection failed. Please try again.");
      }

      const transactionResponse = await authFetch(`/api/payout-requests/${request.id}/escrow/transaction`, {
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
        throw new Error(transactionPayload.error ?? "Unable to prepare escrow transaction.");
      }

      const signature = await signAndSendTransaction(
        transactionPayload.transaction.transactionBase64,
        transactionPayload.transaction.rpcUrl
      );

      if (!signature) {
        throw new Error("Wallet did not return a transaction signature.");
      }

      const recordResponse = await authFetch(`/api/payout-requests/${request.id}/escrow/record`, {
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
        throw new Error(recordPayload.error ?? "Unable to record escrow transaction.");
      }

      setMessage(`${getActionLabel(action)} transaction confirmed: ${signature.slice(0, 10)}...`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete escrow action.");
    } finally {
      setActiveAction(null);
    }
  };

  const escrow = request.escrow;
  const availableActions: EscrowAction[] = [
    ...(canCreate ? (["create"] as const) : []),
    ...(canAccept ? (["accept"] as const) : []),
    ...(canMarkPaid ? (["mark_paid"] as const) : []),
    ...(canComplete ? (["complete"] as const) : []),
    ...(canCancel ? (["cancel"] as const) : [])
  ];

  if (!escrow && availableActions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-display text-headline-md text-on-surface">Solana Escrow</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            {escrow
              ? `${escrow.status.replace(/_/g, " ")} on ${escrow.cluster}`
              : "Fund this request through the CashNode escrow program."}
          </p>
          {escrow ? (
            <p className="mt-1 break-all text-xs text-on-surface-variant">
              {escrow.escrowAddress} · {formatTokenUnits(
                escrow.amountTokenUnits + escrow.agentFeeTokenUnits + (escrow.platformFeeTokenUnits ?? 0)
              )}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          {availableActions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={Boolean(activeAction)}
              onClick={() => void runEscrowAction(action)}
              className={`rounded-xl px-5 py-3 text-sm font-semibold shadow-md disabled:cursor-not-allowed disabled:opacity-55 ${
                action === "cancel" ? "border border-stone-200 bg-white text-on-surface" : "bg-primary text-white"
              }`}
            >
              {activeAction === action ? "Waiting for wallet..." : getActionLabel(action)}
            </button>
          ))}

          {!publicKey ? (
            <button
              type="button"
              onClick={() => {
                connectWallet().catch((error) => {
                  setMessage(error instanceof Error ? error.message : "Unable to connect wallet.");
                });
              }}
              className="rounded-xl border border-primary/15 bg-white px-5 py-3 text-sm font-semibold text-primary"
            >
              {status === "connecting" ? "Connecting..." : "Connect wallet"}
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            message.toLowerCase().includes("confirmed") ? "bg-primary/10 text-primary" : "bg-[#fff1f1] text-[#b42318]"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
