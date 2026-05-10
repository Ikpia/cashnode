# CashNode Escrow Program

This repo includes a minimal Anchor escrow program at `programs/cashnode_escrow`.

The contract locks an SPL token mint configured as CashNode's USDT mint for the active cluster. The sender deposits token base units into a program-owned vault token account when creating the payout. On completion, the principal is released to the agent token account and the agent fee is released to the treasury token account.

## Prerequisites

Install Rust, Solana CLI, and Anchor:

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

Verify:

```bash
rustc --version
solana --version
anchor --version
```

## Localnet

In one terminal:

```bash
solana-test-validator
```

In another terminal:

```bash
solana config set --url localhost
solana airdrop 2
pnpm run anchor:build
pnpm run anchor:deploy:localnet
```

Then run the app with:

```bash
NEXT_PUBLIC_SOLANA_CLUSTER=localnet NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899 pnpm dev
```

## Devnet

```bash
solana config set --url devnet
solana airdrop 2
pnpm run anchor:build
pnpm run anchor:deploy:devnet
```

Set these environment variables for the app:

```bash
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CASHNODE_ESCROW_PROGRAM_ID=HSo8cgjmAttDUi7rpLUEz8QUmq1SUw4yA2eqPgwdThzz
CASHNODE_ESCROW_PROGRAM_ID=HSo8cgjmAttDUi7rpLUEz8QUmq1SUw4yA2eqPgwdThzz
NEXT_PUBLIC_CASHNODE_USDT_MINT=<spl-usdt-mint-for-this-cluster>
CASHNODE_USDT_MINT=<spl-usdt-mint-for-this-cluster>
NEXT_PUBLIC_CASHNODE_USDT_DECIMALS=6
CASHNODE_USDT_DECIMALS=6
```

Optional:

```bash
CASHNODE_ESCROW_TREASURY_PUBLIC_KEY=<fee-wallet-public-key>
```

If no treasury is configured, the app uses the sender wallet as the fee receiver for demo settlement transactions.

## Devnet USDT note

Devnet does not have one canonical production USDT mint. For testing, create or choose an SPL token mint with 6 decimals, fund the sender wallet's associated token account, and set that mint as `CASHNODE_USDT_MINT` / `NEXT_PUBLIC_CASHNODE_USDT_MINT`.
