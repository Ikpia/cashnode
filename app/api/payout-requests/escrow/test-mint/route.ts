import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMint
} from "@solana/spl-token";
import {
  getCashNodeEscrowCluster,
  getCashNodeEscrowRpcUrl,
  getCashNodeUsdtDecimals,
  getCashNodeUsdtMint,
  getEscrowTokenUnitsForTokenAmount
} from "@/lib/cashnode-escrow";
import { getCurrentSessionUser } from "@/lib/auth-session";

export const runtime = "nodejs";

const DEFAULT_TEST_MINT_AMOUNT = 1000;
const MAX_TEST_MINT_AMOUNT = 1000;

function readOptionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseMintAuthorityKeypair() {
  const rawSecret =
    process.env.CASHNODE_TEST_USDT_MINT_AUTHORITY_SECRET_KEY?.trim() ||
    process.env.CASHNODE_USDT_MINT_AUTHORITY_SECRET_KEY?.trim() ||
    "";

  if (!rawSecret) {
    return null;
  }

  try {
    const secretKey = rawSecret.startsWith("[")
      ? Uint8Array.from(JSON.parse(rawSecret) as number[])
      : Uint8Array.from(Buffer.from(rawSecret, "base64"));

    return Keypair.fromSecretKey(secretKey);
  } catch {
    throw new Error("Invalid CASHNODE_TEST_USDT_MINT_AUTHORITY_SECRET_KEY format.");
  }
}

function isServerFaucetEnabled() {
  return process.env.CASHNODE_TEST_USDT_FAUCET_ENABLED === "true";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (getCashNodeEscrowCluster() === "mainnet-beta") {
      return NextResponse.json({ error: "Test USDT minting is disabled on mainnet." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const walletAddress = readOptionalString(body, "walletAddress");
    const requestedAmount = Number(body.tokenAmount ?? DEFAULT_TEST_MINT_AMOUNT);
    const tokenAmount =
      Number.isFinite(requestedAmount) && requestedAmount > 0
        ? Math.min(requestedAmount, MAX_TEST_MINT_AMOUNT)
        : DEFAULT_TEST_MINT_AMOUNT;

    if (!walletAddress) {
      return NextResponse.json({ error: "Connect a Solana wallet before minting test USDT." }, { status: 400 });
    }

    let recipient: PublicKey;

    try {
      recipient = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address format." }, { status: 400 });
    }

    const rpcUrl = getCashNodeEscrowRpcUrl();
    const connection = new Connection(rpcUrl, "confirmed");
    const tokenMint = new PublicKey(getCashNodeUsdtMint());
    const mintInfo = await getMint(connection, tokenMint, "confirmed", TOKEN_PROGRAM_ID);

    if (!mintInfo.mintAuthority) {
      return NextResponse.json({ error: "This test USDT mint no longer has a mint authority." }, { status: 400 });
    }

    const tokenUnits = getEscrowTokenUnitsForTokenAmount(tokenAmount);
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      recipient,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const serverMintAuthority = parseMintAuthorityKeypair();

    if (serverMintAuthority && isServerFaucetEnabled()) {
      if (!mintInfo.mintAuthority.equals(serverMintAuthority.publicKey)) {
        return NextResponse.json(
          { error: "Configured faucet wallet is not the mint authority for this test USDT token." },
          { status: 400 }
        );
      }

      const transaction = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          serverMintAuthority.publicKey,
          recipientTokenAccount,
          recipient,
          tokenMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(
          tokenMint,
          recipientTokenAccount,
          serverMintAuthority.publicKey,
          tokenUnits,
          [],
          TOKEN_PROGRAM_ID
        )
      );
      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.feePayer = serverMintAuthority.publicKey;
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.sign(serverMintAuthority);

      const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false });

      return NextResponse.json({
        mode: "server",
        signature,
        tokenAmount,
        tokenUnits,
        tokenMint: tokenMint.toBase58(),
        tokenDecimals: getCashNodeUsdtDecimals(),
        tokenAccount: recipientTokenAccount.toBase58(),
        rpcUrl
      });
    }

    if (!mintInfo.mintAuthority.equals(recipient)) {
      return NextResponse.json(
        {
          error:
            "This faucet can mint with the connected wallet only if that wallet is the test token mint authority. To let every tester mint, add CASHNODE_TEST_USDT_MINT_AUTHORITY_SECRET_KEY and CASHNODE_TEST_USDT_FAUCET_ENABLED=true on the backend."
        },
        { status: 403 }
      );
    }

    const transaction = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        recipient,
        recipientTokenAccount,
        recipient,
        tokenMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(tokenMint, recipientTokenAccount, recipient, tokenUnits, [], TOKEN_PROGRAM_ID)
    );
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.feePayer = recipient;
    transaction.recentBlockhash = latestBlockhash.blockhash;

    return NextResponse.json({
      mode: "wallet",
      transactionBase64: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
      tokenAmount,
      tokenUnits,
      tokenMint: tokenMint.toBase58(),
      tokenDecimals: getCashNodeUsdtDecimals(),
      tokenAccount: recipientTokenAccount.toBase58(),
      rpcUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mint test USDT.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
