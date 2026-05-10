import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { recordPayoutEscrowSignature } from "@/lib/payout-requests";

export const runtime = "nodejs";

type EscrowRecordBody = {
  action?: "create" | "accept" | "mark_paid" | "complete" | "cancel";
  signature?: string;
  walletAddress?: string;
  escrowAddress?: string;
  referenceSeed?: string;
};

const validEscrowActions = ["create", "accept", "mark_paid", "complete", "cancel"] as const;
type ValidEscrowAction = (typeof validEscrowActions)[number];

function isValidEscrowAction(action: unknown): action is ValidEscrowAction {
  return typeof action === "string" && validEscrowActions.includes(action as ValidEscrowAction);
}

function readOptionalString(body: Record<string, unknown>, key: keyof EscrowRecordBody) {
  const value = body[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === "string" ? value : null;
}

function isValidSolanaAddress(value: string) {
  try {
    return Boolean(new PublicKey(value));
  } catch {
    return false;
  }
}

function isValidSolanaSignature(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { requestId } = await context.params;
    const rawBody = await request.json();

    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const body = rawBody as Record<string, unknown>;
    const rawAction = readOptionalString(body, "action");
    const rawSignature = readOptionalString(body, "signature");
    const rawWalletAddress = readOptionalString(body, "walletAddress");
    const rawEscrowAddress = readOptionalString(body, "escrowAddress");
    const rawReferenceSeed = readOptionalString(body, "referenceSeed");

    if (rawAction === null || rawSignature === null || rawWalletAddress === null || rawEscrowAddress === null || rawReferenceSeed === null) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const action = rawAction ?? "create";
    const signature = rawSignature?.trim() ?? "";
    const walletAddress = rawWalletAddress?.trim() ?? "";
    const escrowAddress = rawEscrowAddress?.trim();
    const referenceSeed = rawReferenceSeed?.trim();

    if (!isValidEscrowAction(action)) {
      return NextResponse.json({ error: "Invalid escrow action." }, { status: 400 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Transaction signature is required." }, { status: 400 });
    }

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required." }, { status: 400 });
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format." }, { status: 400 });
    }

    if (!isValidSolanaSignature(signature)) {
      return NextResponse.json({ error: "Invalid transaction signature format." }, { status: 400 });
    }

    if (escrowAddress && !isValidSolanaAddress(escrowAddress)) {
      return NextResponse.json({ error: "Invalid escrow address format." }, { status: 400 });
    }

    if (referenceSeed && !/^[a-f0-9]{64}$/i.test(referenceSeed)) {
      return NextResponse.json({ error: "Invalid escrow reference seed format." }, { status: 400 });
    }

    const payoutRequest = await recordPayoutEscrowSignature({
      requestId,
      actorUser: user,
      action,
      signature,
      walletAddress,
      escrowAddress,
      referenceSeed
    });

    return NextResponse.json({ request: payoutRequest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record escrow transaction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
