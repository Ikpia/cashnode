# Changelog

## Unreleased

- Added Solana escrow signature verification before off-chain escrow status advances. Recording now checks transaction confirmation, failed transaction metadata, expected signer, escrow account, program instruction, replay protection, pending signatures, and retryable RPC/not-found states.
- Added a Node test harness with hermetic MongoDB and Solana RPC fakes for escrow recording tests.
- Added GeoJSON agent presence storage, idempotent legacy presence backfill, safe 2dsphere index creation, and geo-aware fresh-presence matching that keeps registered hub fallback.
