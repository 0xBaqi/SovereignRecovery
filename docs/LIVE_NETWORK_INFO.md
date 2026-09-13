# Live Network & Attestcoin Configuration

Verified directly via live on-chain queries on September 13, 2026.

---

## 1. Network Disambiguation (DO NOT CONFUSE)

| Concept | Identifier | Value | Notes |
| :--- | :--- | :--- | :--- |
| **Ethereum Sepolia EVM Chain ID** | `chainId` | `11155111` (`0xaa36a7`) | Standard EVM chain identifier for Sepolia testnet. |
| **Attestcoin Source Chain Key** | `chainKey` | `1` | Creditcoin's internal unique identifier for Sepolia within the attestation precompiles (`PrecompileChainInfoProvider`). |
| **Creditcoin CC3 EVM Chain ID** | `chainId` | `102031` (`0x18e8f`) | Creditcoin CC3 Testnet EVM execution layer chain identifier (`eth_chainId`). |

> **CRITICAL ARCHITECTURAL RULE:**
> `chainKey` (1) and `chainId` (11155111 / 102031) are **NEVER INTERCHANGEABLE**.
> - `chainKey` is used by the `NativeQueryVerifier` precompile (`0xFD2`) and `ProofBuilder` to target the verified source chain.
> - `destinationChainId` in `RecoveryAuthorized` and `SovereignVault` is the EVM `block.chainid` (`102031`).

---

## 2. Live Endpoints & Precompiles

- **Creditcoin CC3 RPC:** `https://rpc.cc3-testnet.creditcoin.network`
  - Verified EVM Chain ID: `102031` (Hex: `0x18e8f`)
- **Sepolia RPC:** `https://ethereum-sepolia-rpc.publicnode.com`
  - Verified EVM Chain ID: `11155111` (Hex: `0xaa36a7`)
- **Attestcoin Proof Builder Service:** `https://prover.cc3-testnet.creditcoin.network/`
  - HTTP Status: `200 OK`
- **Native Query Verifier Precompile Address:** `0x0000000000000000000000000000000000000FD2` (`0xFD2` / 4050)
- **ChainInfo Precompile:** Available at default precompile address on Creditcoin CC3.

---

## 3. Supported Chains on Creditcoin CC3 (Queried Live)

```json
[
  {
    "chainKey": 3,
    "chainId": 1,
    "chainName": "Ethereum",
    "chainEncoding": 1
  },
  {
    "chainKey": 1,
    "chainId": 11155111,
    "chainName": "Sepolia ethereum",
    "chainEncoding": 1
  }
]
```

---

## 4. Installed Package Versions

- `@gluwa/asc-contracts`: `0.2.1` (Pinned)
- `@gluwa/usc-sdk`: `0.18.0` (Pinned)
- `@openzeppelin/contracts`: `5.1.0` (Pinned)
- `hardhat`: `2.28.6`
- `@nomicfoundation/hardhat-toolbox`: `5.0.0`
- `solc`: `0.8.28` with `viaIR: true`
