"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PickupLocationSelector } from "@/components/pickup-location-selector";
import { useWallet } from "@/components/wallet-provider";
import { authFetch } from "@/lib/client-auth";
import { nigeriaPickupLocations } from "@/lib/pickup-locations";

type EscrowQuote = {
  totalToken: number;
  requiredTokenUnits: number;
  tokenMint: string;
  tokenDecimals: number;
  rpcUrl: string;
};

function formatUsdt(value: number) {
  return `${value.toFixed(2)} USDT`;
}

function formatSol(lamports: number) {
  return `${(lamports / 1_000_000_000).toLocaleString("en-US", {
    maximumFractionDigits: 6
  })} SOL`;
}

function formatTokenUnits(units: number, decimals: number) {
  return `${(units / 10 ** decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals
  })} USDT`;
}

async function recordEscrowSignatureWithRetry(input: {
  requestId: string;
  action: "create";
  signature: string;
  walletAddress: string;
  escrowAddress: string;
  referenceSeed: string;
}) {
  let lastError = "Unable to record escrow transaction.";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const recordResponse = await authFetch(`/api/payout-requests/${input.requestId}/escrow/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: input.action,
          signature: input.signature,
          walletAddress: input.walletAddress,
          escrowAddress: input.escrowAddress,
          referenceSeed: input.referenceSeed
        })
      });
      const recordPayload = await recordResponse.json().catch(() => ({}));

      if (recordResponse.ok) {
        return;
      }

      lastError = typeof recordPayload.error === "string" ? recordPayload.error : lastError;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }

    await new Promise((resolve) => window.setTimeout(resolve, attempt * 500));
  }

  throw new Error(
    `Transaction sent but failed to record. Signature: ${input.signature}. Please contact support with this signature. ${lastError}`
  );
}

export function SenderPayoutForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const { status, publicKey, shortAddress, connectWallet, signAndSendTransaction } = useWallet();
  const [message, setMessage] = useState(initialError);
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">(initialError ? "error" : "info");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showMessage = (nextMessage: string, tone: "error" | "success" | "info" = "info") => {
    setMessage(nextMessage);
    setMessageTone(tone);
  };

  const loadEscrowQuote = async (tokenAmount: number) => {
    const response = await authFetch(`/api/payout-requests/escrow/quote?tokenAmount=${encodeURIComponent(tokenAmount)}`, {
      method: "GET",
      cache: "no-store"
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to estimate the escrow amount.");
    }

    return payload as EscrowQuote;
  };

  const ensureWalletCanFund = async (quote: EscrowQuote) => {
    let walletAddress = publicKey;

    if (!walletAddress) {
      walletAddress = await connectWallet();
    }

    if (!walletAddress) {
      throw new Error("Connect your Solana wallet before sending.");
    }

    const connection = new Connection(quote.rpcUrl, "confirmed");
    const walletPublicKey = new PublicKey(walletAddress);
    const tokenMint = new PublicKey(quote.tokenMint);
    const senderTokenAccount = getAssociatedTokenAddressSync(tokenMint, walletPublicKey, true, TOKEN_PROGRAM_ID);
    const tokenBalance = await connection
      .getTokenAccountBalance(senderTokenAccount)
      .then((balance) => Number(balance.value.amount))
      .catch((error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";

        if (message.includes("could not find account") || message.includes("invalid param")) {
          return 0;
        }

        throw new Error("Unable to check wallet balance. Please try again.");
      });

    if (tokenBalance < quote.requiredTokenUnits) {
      throw new Error(
        `Insufficient USDT balance. You need ${formatTokenUnits(
          quote.requiredTokenUnits,
          quote.tokenDecimals
        )}, but this wallet has ${formatTokenUnits(
          tokenBalance,
          quote.tokenDecimals
        )}.`
      );
    }

    const solBalance = await connection.getBalance(walletPublicKey);
    const minimumSolForFeesAndRent = 5_000_000;

    if (solBalance < minimumSolForFeesAndRent) {
      throw new Error(
        `This wallet has enough USDT but needs a little SOL for network fees and account rent. Keep at least ${formatSol(
          minimumSolForFeesAndRent
        )}; current balance is ${formatSol(solBalance)}.`
      );
    }

    return walletAddress;
  };

  const submit = async (formData: FormData) => {
    setIsSubmitting(true);
    showMessage("Checking wallet balance and preparing payment...", "info");

    let createdRequestId = "";
    let escrowSignatureSubmitted = false;
    let escrowTransactionAttempted = false;

    try {
      const rawTokenAmount = String(formData.get("tokenAmount") ?? "").trim();
      const tokenAmount = Number(rawTokenAmount);

      if (!rawTokenAmount || !Number.isFinite(tokenAmount) || tokenAmount <= 0) {
        throw new Error("Enter a valid amount greater than 0.");
      }

      const quote = await loadEscrowQuote(tokenAmount);
      const walletAddress = await ensureWalletCanFund(quote);

      showMessage(`Wallet ready. Securing ${formatUsdt(quote.totalToken)} total payment flow...`, "info");

      const createResponse = await authFetch("/api/payout-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tokenType: "USDT",
          tokenAmount,
          receiverName: String(formData.get("receiverName") ?? ""),
          receiverPhone: String(formData.get("receiverPhone") ?? ""),
          pickupArea: String(formData.get("pickupArea") ?? ""),
          pickupLocationDetail: String(formData.get("pickupLocationDetail") ?? ""),
          notes: String(formData.get("notes") ?? "")
        })
      });
      const createPayload = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createPayload.error ?? "Unable to create payout request.");
      }

      const payoutRequest = createPayload.request as { id: string };
      createdRequestId = payoutRequest.id;

      const transactionResponse = await authFetch(`/api/payout-requests/${createdRequestId}/escrow/transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "create",
          walletAddress
        })
      });
      const transactionPayload = await transactionResponse.json();

      if (!transactionResponse.ok) {
        throw new Error(transactionPayload.error ?? "Unable to prepare escrow transaction.");
      }

      escrowTransactionAttempted = true;
      const signature = await signAndSendTransaction(transactionPayload.transaction.transactionBase64, transactionPayload.transaction.rpcUrl);

      if (!signature) {
        throw new Error("Wallet did not return a transaction signature.");
      }

      escrowSignatureSubmitted = true;
      window.localStorage.setItem(
        "cashnode_pending_escrow_record",
        JSON.stringify({
          requestId: createdRequestId,
          signature,
          walletAddress,
          escrowAddress: transactionPayload.transaction.escrowAddress,
          referenceSeed: transactionPayload.transaction.referenceSeedHex,
          createdAt: new Date().toISOString()
        })
      );
      await recordEscrowSignatureWithRetry({
        requestId: createdRequestId,
        action: "create",
        signature,
        walletAddress,
        escrowAddress: transactionPayload.transaction.escrowAddress,
        referenceSeed: transactionPayload.transaction.referenceSeedHex
      });
      window.localStorage.removeItem("cashnode_pending_escrow_record");

      showMessage("Funds secured. Redirecting to tracking...", "success");
      router.push(`/request-detail?id=${createdRequestId}`);
      router.refresh();
    } catch (error) {
      if (createdRequestId && !escrowSignatureSubmitted && !escrowTransactionAttempted) {
        await authFetch(`/api/payout-requests/${createdRequestId}/cancel`, {
          method: "POST"
        }).catch(() => undefined);
      }

      showMessage(error instanceof Error ? error.message : "Unable to send this payout.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form action={submit} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-stone-600">Amount (USDT)</span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">T</span>
            <input
              id="sender-token-amount"
              name="tokenAmount"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="0.00"
              className="w-full rounded-xl border border-stone-200 px-4 py-3 pl-8 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-stone-600">Receiver Name</span>
          <input
            name="receiverName"
            type="text"
            required
            placeholder="Full legal name"
            className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-stone-600">Receiver Phone</span>
          <input
            name="receiverPhone"
            type="tel"
            required
            placeholder="+234 800 000 0000"
            className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          <p className="text-xs text-on-surface-variant">Use the number the receiver can access during pickup day.</p>
        </label>

        <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4 text-sm">
          <div className="font-semibold text-on-surface">Sender wallet</div>
          <div className="mt-2 text-on-surface-variant">
            {publicKey ? `Connected: ${shortAddress}` : "Connect a wallet before sending. We check balance before the request is created."}
          </div>
          <button
            type="button"
            onClick={() => {
              connectWallet().catch((error) => {
                showMessage(error instanceof Error ? error.message : "Failed to connect wallet.", "error");
              });
            }}
            className="mt-3 rounded-xl border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary"
          >
            {status === "connecting" ? "Connecting..." : publicKey ? "Change wallet" : "Connect wallet"}
          </button>
        </div>
      </div>

      <PickupLocationSelector locations={nigeriaPickupLocations} />

      <label className="space-y-2">
        <span className="text-sm font-semibold text-stone-600">Notes (Optional)</span>
        <textarea
          name="notes"
          rows={4}
          placeholder="Purpose of payment..."
          className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      <div className="rounded-2xl bg-primary/5 px-4 py-4 text-sm text-on-surface-variant">
        The wallet is checked before sending. If the connected wallet cannot cover the secured payment, the payout will not be created.
      </div>

      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            messageTone === "error"
              ? "bg-[#fff1f1] text-[#b42318]"
              : messageTone === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-primary/10 text-primary"
          }`}
        >
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="primary-gradient w-full rounded-xl px-6 py-4 text-lg font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Securing funds..." : "Send and Secure Funds"}
      </button>
    </form>
  );
}
