# Changelog

## Unreleased

- Added Solana escrow signature verification before off-chain escrow status advances. Recording now checks transaction confirmation, failed transaction metadata, expected signer, escrow account, program instruction, replay protection, pending signatures, and retryable RPC/not-found states.
- Added a Node test harness with hermetic MongoDB and Solana RPC fakes for escrow recording tests.
