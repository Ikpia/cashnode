import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { buildCashNodeEscrowTransaction } from "@/lib/cashnode-escrow";
import { getUserById } from "@/lib/users";
import {
  getPayoutRequestByIdForUser,
  initializePayoutEscrow,
  type PayoutRequestRecord
} from "@/lib/payout-requests";

export const runtime = "nodejs";

type EscrowTransactionBody = {
  action?: "create" | "accept" | "mark_paid" | "complete" | "cancel";
  walletAddress?: string;
};

const validEscrowActions = ["create", "accept", "mark_paid", "complete", "cancel"] as const;
type ValidEscrowAction = (typeof validEscrowActions)[number];

function isValidEscrowAction(action: unknown): action is ValidEscrowAction {
  return typeof action === "string" && validEscrowActions.includes(action as ValidEscrowAction);
}

function readOptionalString(body: Record<string, unknown>, key: keyof EscrowTransactionBody) {
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

async function getAgentWallet(request: PayoutRequestRecord) {
  if (request.escrow?.agentWallet) {
    return request.escrow.agentWallet;
  }

  if (!request.assignedAgent?.userId) {
    return null;
  }

  const agent = await getUserById(request.assignedAgent.userId);
  return agent?.walletAddress ?? null;
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
    const rawWalletAddress = readOptionalString(body, "walletAddress");

    if (rawAction === null || rawWalletAddress === null) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const action = rawAction ?? "create";
    const walletAddress = rawWalletAddress?.trim() ?? "";

    if (!isValidEscrowAction(action)) {
      return NextResponse.json({ error: "Invalid escrow action." }, { status: 400 });
    }

    if (!walletAddress) {
      return NextResponse.json({ error: "Connect a Solana wallet first." }, { status: 400 });
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format." }, { status: 400 });
    }

    const payoutRequest = await getPayoutRequestByIdForUser(requestId, user);

    if (!payoutRequest) {
      return NextResponse.json({ error: "Payout request not found." }, { status: 404 });
    }

    if ((action === "create" || action === "cancel" || action === "complete") && payoutRequest.senderUserId !== user.id) {
      return NextResponse.json({ error: "Only the sender can prepare this escrow transaction." }, { status: 403 });
    }

    if ((action === "accept" || action === "mark_paid") && payoutRequest.assignedAgent?.userId !== user.id) {
      return NextResponse.json({ error: "Only the assigned agent can prepare this escrow transaction." }, { status: 403 });
    }

    const transaction = await buildCashNodeEscrowTransaction({
      action,
      payerWallet: walletAddress,
      request: payoutRequest,
      referenceSeedHex: payoutRequest.escrow?.referenceSeed,
      escrowAddress: payoutRequest.escrow?.escrowAddress,
      agentWallet: action === "complete" ? await getAgentWallet(payoutRequest) : undefined,
      senderWallet: payoutRequest.escrow?.senderWallet
    });

    if (action === "create") {
      await initializePayoutEscrow({
        requestId,
        senderUser: user,
        senderWallet: walletAddress,
        escrowAddress: transaction.escrowAddress,
        referenceSeed: transaction.referenceSeedHex,
        amountTokenUnits: transaction.amountTokenUnits,
        agentFeeTokenUnits: transaction.agentFeeTokenUnits,
        platformFeeTokenUnits: transaction.platformFeeTokenUnits,
        programId: transaction.programId,
        cluster: transaction.cluster
      });
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare escrow transaction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
