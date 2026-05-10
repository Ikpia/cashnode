# CashNode

CashNode lets Nigerian receivers collect NGN cash from nearby POS agents while the sender secures the USDT side of the payout through a Solana devnet escrow program.

## Local Setup

Install dependencies:

```bash
pnpm install
```

Run the app:

```bash
pnpm dev
```

Open:

```txt
http://localhost:3000
```

## Devnet Escrow And Test USDT

CashNode is currently configured for Solana devnet testing. The sender connects Phantom, mints test USDT if needed, then sends and secures funds into the escrow program.

### Required Devnet Environment Values

Add these values to `.env`:

```env
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_CASHNODE_ESCROW_PROGRAM_ID=your_deployed_devnet_program_id
CASHNODE_ESCROW_PROGRAM_ID=your_deployed_devnet_program_id

NEXT_PUBLIC_CASHNODE_USDT_MINT=your_devnet_test_usdt_mint
CASHNODE_USDT_MINT=your_devnet_test_usdt_mint
NEXT_PUBLIC_CASHNODE_USDT_DECIMALS=6
CASHNODE_USDT_DECIMALS=6
```

For the current devnet test token used during development:

```env
NEXT_PUBLIC_CASHNODE_USDT_MINT=BQStgDwQejqTetrmYX6bn9CTTbyBKirZRKiws7tYHw5R
CASHNODE_USDT_MINT=BQStgDwQejqTetrmYX6bn9CTTbyBKirZRKiws7tYHw5R
NEXT_PUBLIC_CASHNODE_USDT_DECIMALS=6
CASHNODE_USDT_DECIMALS=6
```

### Enable Test USDT Minting

To let testers mint devnet test USDT from the app, add:

```env
CASHNODE_TEST_USDT_FAUCET_ENABLED=true
CASHNODE_TEST_USDT_MINT_AUTHORITY_SECRET_KEY=[your_devnet_mint_authority_keypair_array]
```

`CASHNODE_TEST_USDT_MINT_AUTHORITY_SECRET_KEY` must be the private key/keypair for the wallet that owns the mint authority of `CASHNODE_USDT_MINT`.

Do not:

- Commit this secret to GitHub.
- Prefix it with `NEXT_PUBLIC_`.
- Use a wallet with real funds.
- Enable this faucet for mainnet.

The faucet route blocks `mainnet-beta`, but the key should still only be used for devnet/local testing.

### How To Mint Test USDT In The App

1. Open Phantom.
2. Go to developer settings and select `Solana Devnet`.
3. Connect Phantom in CashNode
4. Go to the sender dashboard.
5. Click `Mint 1,000 test USDT`.
6. Wait for the success message.

Your Phantom wallet must also have a small amount of devnet SOL before minting test USDT. Devnet SOL is used for transaction fees and token account rent.

If you do not have devnet SOL:

1. Go to `https://faucet.solana.com`.
2. Select `Devnet`.
3. Paste your Phantom wallet address.
4. Request SOL.
5. Return to CashNode and click `Mint 1,000 test USDT` again.

If minting fails, confirm:

- Your app is running with `NEXT_PUBLIC_SOLANA_CLUSTER=devnet`.
- `CASHNODE_USDT_MINT` matches the devnet token mint.
- `CASHNODE_TEST_USDT_MINT_AUTHORITY_SECRET_KEY` belongs to the mint authority wallet.
- The faucet flag is set to `CASHNODE_TEST_USDT_FAUCET_ENABLED=true`.

### How To Send Funds On Devnet

1. Sign in as a sender.
2. Open `/sender-dashboard`.
3. Connect Phantom on Solana Devnet.
4. If your wallet has no test USDT, click `Mint 1,000 test USDT`.
5. Enter the payout amount in USDT.
6. Fill receiver name, receiver phone, and pickup area.
7. Click `Send and Secure Funds`.
8. Approve the Phantom transaction.
9. Wait for the app to redirect to the request detail page.

A successful escrow funding will produce a server log like:

```txt
POST /api/payout-requests/{requestId}/escrow/record 200
```

The request should then appear as `Awaiting Agent`.

### Cancelling A Funded Request

If a request is already funded on-chain, cancellation must also be signed in Phantom so the escrow can refund the sender.

To cancel:

1. Open `/sender-dashboard`.
2. Find the request in `Recent Transactions`.
3. Click `Cancel`.
4. Approve the Phantom transaction.

You can also open the request detail page and use the `Cancel escrow` action.

## Admin Dashboard

The admin dashboard is at:

```txt
/admin
```

There are two ways to enter the admin dashboard.

### Option 1: Admin Phone/User Allowlist

Add one or both of these values to `.env`:

```env
CASHNODE_ADMIN_PHONE_NUMBERS=+2349138974917
CASHNODE_ADMIN_USER_IDS=comma_separated_user_ids
```

If the signed-in user's phone number or user ID matches, `/admin` opens directly.

### Option 2: Admin Access Key

If the signed-in user is not on the admin allowlist, the admin page shows an admin key input.

Set the key in `.env`:

```env
CASHNODE_ADMIN_ACCESS_KEY=QStgDwQejqTetrmYX6bn9CTTby
```

Then:

1. Sign in normally.
2. Open `/admin`.
3. Enter the admin access key.
4. Submit the form.
5. The app grants temporary admin access with a secure cookie.

Do not expose the admin key publicly or commit it to GitHub.

## Smart Contract Deployment

The escrow program is an Anchor program in:

```txt
programs/cashnode_escrow/src/lib.rs
```

If you change the contract, rebuild and redeploy/upgrade it before testing new escrow requests.

For Solana Playground:

1. Confirm `declare_id!` matches `CASHNODE_ESCROW_PROGRAM_ID`.
2. Click `Build`.
3. Click `Deploy` or `Upgrade`.
4. After deployment succeeds, update `.env` if the program ID changed.
5. Restart the Next.js dev server.

Old requests created before a contract upgrade may not be compatible with the new account layout. Use fresh test requests after redeploying.
