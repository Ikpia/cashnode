import { createHash } from "node:crypto";
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import type { PayoutRequestRecord } from "@/lib/payout-requests";

export type CashNodeEscrowAction = "create" | "accept" | "mark_paid" | "complete" | "cancel";

const DEFAULT_PROGRAM_ID = "HSo8cgjmAttDUi7rpLUEz8QUmq1SUw4yA2eqPgwdThzz";
const DEFAULT_USDT_DECIMALS = 6;

function getClusterName() {
  return process.env.NEXT_PUBLIC_SOLANA_CLUSTER || process.env.CASHNODE_SOLANA_CLUSTER || "devnet";
}

export function getCashNodeEscrowProgramId() {
  return process.env.NEXT_PUBLIC_CASHNODE_ESCROW_PROGRAM_ID || process.env.CASHNODE_ESCROW_PROGRAM_ID || DEFAULT_PROGRAM_ID;
}

export function getCashNodeUsdtMint() {
  const mint = process.env.NEXT_PUBLIC_CASHNODE_USDT_MINT || process.env.CASHNODE_USDT_MINT;

  if (!mint?.trim()) {
    throw new Error("Missing CASHNODE_USDT_MINT. Add the SPL USDT mint address for the active Solana cluster.");
  }

  return mint.trim();
}

export function getCashNodeUsdtDecimals() {
  const decimals = Number(process.env.NEXT_PUBLIC_CASHNODE_USDT_DECIMALS ?? process.env.CASHNODE_USDT_DECIMALS ?? DEFAULT_USDT_DECIMALS);
  return Number.isInteger(decimals) && decimals >= 0 && decimals <= 9 ? decimals : DEFAULT_USDT_DECIMALS;
}

export function getCashNodeEscrowRpcUrl() {
  const explicitRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL;

  if (explicitRpcUrl?.trim()) {
    return explicitRpcUrl.trim();
  }

  switch (getClusterName()) {
    case "localnet":
      return "http://127.0.0.1:8899";
    case "mainnet-beta":
      return "https://api.mainnet-beta.solana.com";
    case "testnet":
      return "https://api.testnet.solana.com";
    default:
      return "https://api.devnet.solana.com";
  }
}

export function getCashNodeEscrowCluster() {
  return getClusterName();
}

export function getEscrowTokenUnitsForTokenAmount(tokenAmount: number) {
  if (!Number.isFinite(tokenAmount) || tokenAmount < 0) {
    throw new Error("Token amount must be a finite non-negative number.");
  }

  if (tokenAmount === 0) {
    return 0;
  }

  const decimals = getCashNodeUsdtDecimals();
  const normalized = tokenAmount.toFixed(decimals + 1);
  const [integerPart, rawDecimalPart = ""] = normalized.split(".");
  const decimalPart = rawDecimalPart.padEnd(decimals + 1, "0");
  const baseUnits = BigInt(`${integerPart}${decimalPart.slice(0, decimals)}`);
  const shouldRoundUp = Number(decimalPart[decimals] ?? "0") >= 5;
  const roundedUnits = baseUnits + (shouldRoundUp ? BigInt(1) : BigInt(0));
  const safeUnits = roundedUnits > BigInt(0) ? roundedUnits : BigInt(1);

  if (safeUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Token amount is too large to process safely.");
  }

  return Number(safeUnits);
}

export function buildReferenceSeedHex(input: { requestId: string; reference: string }) {
  return createHash("sha256").update(`${input.requestId}:${input.reference}`).digest("hex");
}

function instructionDiscriminator(name: string) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function writeU64(value: number | bigint) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function getReferenceSeedBytes(referenceSeedHex: string) {
  const seed = Buffer.from(referenceSeedHex, "hex");

  if (seed.length !== 32) {
    throw new Error("Escrow reference seed must be 32 bytes.");
  }

  return seed;
}

export function deriveCashNodeEscrowAddress(input: { senderWallet: string; referenceSeedHex: string }) {
  const programId = new PublicKey(getCashNodeEscrowProgramId());
  const sender = new PublicKey(input.senderWallet);
  const [escrowAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("request"), sender.toBuffer(), getReferenceSeedBytes(input.referenceSeedHex)],
    programId
  );

  return escrowAddress.toBase58();
}

export function deriveCashNodeEscrowVaultAddress(escrowAddress: string) {
  const programId = new PublicKey(getCashNodeEscrowProgramId());
  const escrow = new PublicKey(escrowAddress);
  const [vaultAddress] = PublicKey.findProgramAddressSync([Buffer.from("vault"), escrow.toBuffer()], programId);
  return vaultAddress.toBase58();
}

export function deriveCashNodeEscrowTreasuryAuthorityAddress() {
  const programId = new PublicKey(getCashNodeEscrowProgramId());
  const [treasuryAuthority] = PublicKey.findProgramAddressSync([Buffer.from("treasury_authority")], programId);
  return treasuryAuthority.toBase58();
}

function getTokenAccount(owner: PublicKey, mint: PublicKey) {
  return getAssociatedTokenAddressSync(mint, owner, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}

function buildInstruction(input: {
  action: CashNodeEscrowAction;
  payerWallet: string;
  request: PayoutRequestRecord;
  referenceSeedHex: string;
  escrowAddress: string;
  vaultAddress: string;
  agentWallet?: string | null;
}) {
  const programId = new PublicKey(getCashNodeEscrowProgramId());
  const payer = new PublicKey(input.payerWallet);
  const requestEscrow = new PublicKey(input.escrowAddress);
  const vaultTokenAccount = new PublicKey(input.vaultAddress);
  const tokenMint = new PublicKey(getCashNodeUsdtMint());

  if (input.action === "create") {
    const referenceSeed = getReferenceSeedBytes(input.referenceSeedHex);
    const amountUnits = getEscrowTokenUnitsForTokenAmount(input.request.tokenAmount);
    const agentFeeUnits = getEscrowTokenUnitsForTokenAmount(input.request.agentFeeToken);
    const platformFeeUnits = getEscrowTokenUnitsForTokenAmount(input.request.platformFeeToken);
    const senderTokenAccount = getTokenAccount(payer, tokenMint);
    const data = Buffer.concat([
      instructionDiscriminator("create_request"),
      referenceSeed,
      writeU64(amountUnits),
      writeU64(agentFeeUnits),
      writeU64(platformFeeUnits)
    ]);

    return new TransactionInstruction({
      programId,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: requestEscrow, isSigner: false, isWritable: true },
        { pubkey: senderTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
      ],
      data
    });
  }

  if (input.action === "cancel") {
    const senderTokenAccount = getTokenAccount(payer, tokenMint);

    return new TransactionInstruction({
      programId,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: requestEscrow, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: senderTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      ],
      data: instructionDiscriminator("cancel_request")
    });
  }

  if (input.action === "complete") {
    if (!input.agentWallet) {
      throw new Error("Assigned agent wallet is required before settling secured funds.");
    }
    const agentWallet = new PublicKey(input.agentWallet);
    const treasuryAuthority = new PublicKey(deriveCashNodeEscrowTreasuryAuthorityAddress());
    const agentTokenAccount = getTokenAccount(agentWallet, tokenMint);
    const treasuryTokenAccount = getTokenAccount(treasuryAuthority, tokenMint);

    return new TransactionInstruction({
      programId,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: requestEscrow, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: agentTokenAccount, isSigner: false, isWritable: true },
        { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
        { pubkey: treasuryAuthority, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      ],
      data: instructionDiscriminator("complete_request")
    });
  }

  const instructionName = input.action === "accept" ? "accept_request" : "mark_paid";

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: requestEscrow, isSigner: false, isWritable: true }
    ],
    data: instructionDiscriminator(instructionName)
  });
}

export async function buildCashNodeEscrowTransaction(input: {
  action: CashNodeEscrowAction;
  payerWallet: string;
  request: PayoutRequestRecord;
  referenceSeedHex?: string | null;
  escrowAddress?: string | null;
  agentWallet?: string | null;
  senderWallet?: string | null;
}) {
  const referenceSeedHex = input.referenceSeedHex || buildReferenceSeedHex({ requestId: input.request.id, reference: input.request.reference });
  const senderWallet = input.senderWallet || input.request.escrow?.senderWallet || (input.action === "create" ? input.payerWallet : null);

  if (input.action !== "create" && !input.escrowAddress && !senderWallet) {
    throw new Error("Escrow address or original sender wallet is required for this escrow action.");
  }

  const escrowAddress =
    input.escrowAddress || deriveCashNodeEscrowAddress({ senderWallet: senderWallet ?? input.payerWallet, referenceSeedHex });
  const vaultAddress = deriveCashNodeEscrowVaultAddress(escrowAddress);
  const connection = new Connection(getCashNodeEscrowRpcUrl(), "confirmed");
  const latestBlockhash = await connection.getLatestBlockhash();
  const transaction = new Transaction({
    feePayer: new PublicKey(input.payerWallet),
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  });
  const tokenMint = new PublicKey(getCashNodeUsdtMint());

  if (input.action === "complete" && input.agentWallet) {
    const payer = new PublicKey(input.payerWallet);
    const agentWallet = new PublicKey(input.agentWallet);
    const treasuryAuthority = new PublicKey(deriveCashNodeEscrowTreasuryAuthorityAddress());

    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        getTokenAccount(agentWallet, tokenMint),
        agentWallet,
        tokenMint
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        getTokenAccount(treasuryAuthority, tokenMint),
        treasuryAuthority,
        tokenMint
      )
    );
  }

  transaction.add(
    buildInstruction({
      action: input.action,
      payerWallet: input.payerWallet,
      request: input.request,
      referenceSeedHex,
      escrowAddress,
      vaultAddress,
      agentWallet: input.agentWallet
    })
  );

  return {
    transactionBase64: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    escrowAddress,
    vaultAddress,
    treasuryAuthority: deriveCashNodeEscrowTreasuryAuthorityAddress(),
    referenceSeedHex,
    amountTokenUnits: getEscrowTokenUnitsForTokenAmount(input.request.tokenAmount),
    agentFeeTokenUnits: getEscrowTokenUnitsForTokenAmount(input.request.agentFeeToken),
    platformFeeTokenUnits: getEscrowTokenUnitsForTokenAmount(input.request.platformFeeToken),
    tokenMint: getCashNodeUsdtMint(),
    tokenDecimals: getCashNodeUsdtDecimals(),
    programId: getCashNodeEscrowProgramId(),
    cluster: getCashNodeEscrowCluster(),
    rpcUrl: getCashNodeEscrowRpcUrl()
  };
}
