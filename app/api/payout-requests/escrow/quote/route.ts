import { NextResponse } from "next/server";
import {
  getCashNodeEscrowRpcUrl,
  getCashNodeUsdtDecimals,
  getCashNodeUsdtMint,
  getEscrowTokenUnitsForTokenAmount
} from "@/lib/cashnode-escrow";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAmount = Number(searchParams.get("tokenAmount") ?? 0);

    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
      return NextResponse.json({ error: "Enter a valid USDT payout amount." }, { status: 400 });
    }

    const platformFeeToken = Math.round(tokenAmount * 0.002 * 100) / 100;
    const agentFeeToken = Math.round(Math.max(tokenAmount * 0.005, 2.5) * 100) / 100;
    const totalToken = Math.round((tokenAmount + platformFeeToken + agentFeeToken) * 100) / 100;
    const amountTokenUnits = getEscrowTokenUnitsForTokenAmount(tokenAmount);
    const agentFeeTokenUnits = getEscrowTokenUnitsForTokenAmount(agentFeeToken);
    const platformFeeTokenUnits = getEscrowTokenUnitsForTokenAmount(platformFeeToken);

    return NextResponse.json({
      tokenAmount,
      platformFeeToken,
      agentFeeToken,
      totalToken,
      amountTokenUnits,
      agentFeeTokenUnits,
      platformFeeTokenUnits,
      requiredTokenUnits: amountTokenUnits + agentFeeTokenUnits + platformFeeTokenUnits,
      tokenMint: getCashNodeUsdtMint(),
      tokenDecimals: getCashNodeUsdtDecimals(),
      rpcUrl: getCashNodeEscrowRpcUrl()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate escrow quote.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
