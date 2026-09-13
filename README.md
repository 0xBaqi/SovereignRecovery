# SovereignRecovery

> **Recover once. Recover across chains.**

SovereignRecovery is a cross-chain account recovery protocol that lets an Ethereum security root authorize recovery of a Creditcoin account, with the authorization transported and cryptographically verified through **Attestcoin** instead of a centralized relayer or oracle.

Built for **BUIDL CTC 2026 Fall**.

## The problem

Account recovery is usually chain-local.

A user may already have a trusted security root on Ethereum, but accounts and vaults on other chains must recreate their own recovery mechanisms, guardians, or trusted relayers.

That fragments security and creates new trust assumptions.

SovereignRecovery asks a simpler question:

**What if one security root could authorize recovery across chains?**

## How it works

SovereignRecovery uses an explicit, nonce-bound recovery authorization.

1. An authorized Ethereum recovery authority emits a `RecoveryAuthorized` event on Sepolia.
2. The event specifies the exact destination chain, destination account, recovery nonce, previous owner, and new owner.
3. Attestcoin attests the Ethereum source block.
4. Attestcoin's proof infrastructure produces cryptographic evidence for the source transaction.
5. SovereignVault submits that evidence to Creditcoin's native verification path.
6. The proof is verified on Creditcoin through the `0xFD2` verifier.
7. SovereignVault validates the event and recovery constraints.
8. Ownership changes from Owner A to Owner B.
9. The recovery nonce advances.
10. Replaying the same proof is rejected on-chain.

## Why Attestcoin is essential

Without Attestcoin, the Creditcoin contract has no trustless way to know that the Ethereum recovery authority actually emitted the required authorization.

A traditional implementation would require a centralized relayer, oracle, backend, or multisig to report what happened on Ethereum.

SovereignRecovery instead makes the foreign-chain transaction itself verifiable by the destination contract.

**Ethereum authorizes. Attestcoin proves. Creditcoin executes.**

## Architecture

```text
Ethereum Sepolia
┌─────────────────────────────┐
│ Recovery Authority          │
│                             │
│ authorizeRecovery(...)      │
│            │                │
│            ▼                │
│ RecoveryAuthorized event    │
└─────────────┬───────────────┘
              │
              │ source transaction
              ▼
┌─────────────────────────────┐
│ Attestcoin                  │
│                             │
│ block attestation           │
│ transaction proof           │
│ continuity evidence         │
└─────────────┬───────────────┘
              │
              │ cryptographic proof
              ▼
Creditcoin CC3
┌─────────────────────────────┐
│ Native verifier 0xFD2       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ SovereignVault              │
│                             │
│ validate source             │
│ validate destination        │
│ validate owner              │
│ validate nonce              │
│ reject replay               │
│            │                │
│            ▼                │
│ Owner A ───────► Owner B    │
└─────────────────────────────┘
```

## Live verified recovery

SovereignRecovery has completed an end-to-end recovery using a real Sepolia transaction, Attestcoin proof, and Creditcoin CC3 execution.

### Ethereum Sepolia

**Recovery authority**

`0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c`

**Recovery source**

`0x2d2470Ff6eD7563d0109d9C180cc9F1805d09fF9`

**Recovery authorization transaction**

`0x0b076ac2c1242f4905c2a9d4e30f56163051ebe558bbab0a5a0f95884bab9363`

**Source block**

`11697145`

### Creditcoin CC3

**SovereignVault**

`0x2d2470Ff6eD7563d0109d9C180cc9F1805d09fF9`

**Creditcoin chain ID**

`102031`

**Attestcoin source chain key**

`1`

**Recovery execution transaction**

`0x473918051d6590c2e3aeb30f2b5c48d00e54ecfa13b97ac738d61b6c9869f483`

**Execution block**

`5481810`

### Recovery result

Previous owner:

`0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c`

New owner:

`0xAE05B00d4bF1ABC3DA94622831AecFBd3539ef21`

Recovery nonce:

`0 → 1`

Query ID:

`0x42b043bcd9c91f0266ae31573d1f3f397ab1601c723d4bd3d1ae3e45e57525fb`

An exact replay of the proof was rejected on-chain with:

```text
Query already processed
```

## Security model

The current implementation enforces:

- access-controlled recovery authorization
- registered recovery source validation
- expected source chain binding
- successful source transaction receipt
- exact `RecoveryAuthorized` event signature
- destination chain binding
- destination account binding
- previous owner validation
- new owner validation
- monotonic recovery nonce
- Attestcoin query deduplication
- exact-proof replay rejection

The authorization is intentionally explicit rather than inferred from historical account state. This prevents an attacker from using an older valid proof to roll the destination account back to stale ownership.

## Attestcoin proof evidence

The successful proof included:

| Field | Value |
|---|---|
| Source chain key | `1` |
| Source block | `11697145` |
| Transaction index | `80` |
| Merkle siblings | `7` |
| Continuity roots | `6` |
| CC3 verifier | `0x0000000000000000000000000000000000000FD2` |

The complete captured proof is stored in:

```text
evidence/attestcoin_proof.json
```

## Contracts

### `MockRecoverySource.sol`

The Ethereum-side MVP recovery authority.

It emits:

```solidity
RecoveryAuthorized(
    uint256 destinationChainId,
    address indexed destinationAccount,
    uint256 recoveryNonce,
    address indexed oldOwner,
    address indexed newOwner
)
```

Only the configured recovery authority can create a valid recovery authorization.

### `SovereignVault.sol`

The Creditcoin-side protected account.

It inherits Attestcoin's `ASCBase`, processes verified foreign-chain receipt evidence, validates the recovery instruction, updates ownership, and advances the recovery nonce.

## Technology

- Solidity
- Hardhat
- OpenZeppelin
- `@gluwa/asc-contracts`
- `@gluwa/usc-sdk`
- Attestcoin
- Creditcoin CC3
- Ethereum Sepolia
- Next.js
- Tailwind CSS
- Vercel

## Run locally

Install protocol dependencies:

```bash
npm install
```

Run the contract tests:

```bash
npm test
```

Run the web console:

```bash
cd web
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Evidence

Reproducible proof and execution artifacts are kept in the repository rather than represented as mocked UI state.

See:

```text
evidence/
docs/MILESTONE_1B_REPORT.md
```

## Current scope and limitations

SovereignRecovery is a hackathon MVP demonstrating the cross-chain recovery primitive.

The Ethereum source currently uses an **owner-controlled, access-controlled recovery authority**. It is not presented as a production Safe integration.

Attestcoin proves the historical source-chain transaction used for recovery. SovereignRecovery does not claim that Attestcoin proves off-chain truth or arbitrary current Ethereum state.

Attestation also introduces source-to-destination latency, so SovereignRecovery is designed as a recovery mechanism rather than an instant emergency freeze mechanism.

## Production direction

The next step is replacing the MVP recovery authority with adapters for established Ethereum security roots such as Safe recovery modules or institutional account-control systems.

The core primitive remains the same:

**authorize recovery once at the security root, prove it cryptographically, and inherit that recovery across chains.**

## Live application

https://sovereign-recovery.vercel.app/

## Repository

https://github.com/0xBaqi/SovereignRecovery

---

**SovereignRecovery — Recover once. Recover across chains.**