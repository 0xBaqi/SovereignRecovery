# Milestone 1B Completion Report — SovereignRecovery (Security Hardened)

**Product:** SovereignRecovery  
**Tagline:** “Recover once. Recover across chains.”  
**Milestone:** 1B — REAL Ethereum Sepolia → Attestcoin → Creditcoin CC3 Recovery Flow  
**Security Status:** HARDENED & REVALIDATED (Access-Controlled Source Authority & Immutable Source Chain Binding)  
**Timestamp:** 2026-09-13T16:54:01.107Z  

---

## 1. Executive Summary

Milestone 1B has been executed and verified against live public testnets without mock substitutions on the live path:
1. **Source Authorization Hardening:** `MockRecoverySource` is restricted strictly to an authorized `recoveryAuthority`. Unauthorized callers are rejected on-chain.
2. **Ethereum Sepolia:** Real `RecoveryAuthorized` event emitted by deployed, access-controlled `MockRecoverySource`.
3. **Attestcoin (USC SDK 0.18.0):** Inclusion and continuity proof generated via the Creditcoin ProofBuilder service following on-chain block attestation.
4. **Creditcoin CC3:** Proof verified on-chain by `SovereignVault` via the native precompile (`0xFD2`).
5. **State Transition:** `SovereignVault` owner transitioned strictly from **Owner A** to **Owner B**, and the sequential recovery nonce incremented.
6. **Replay Protection:** Submitting the exact same proof was rejected on-chain.

---

## 2. Environment & Network Configuration

- **Creditcoin CC3 EVM chainId:** `102031`
- **Sepolia Attestcoin chainKey:** `1`
- **Ethereum Sepolia EVM chainId:** `11155111`
- **Creditcoin CC3 RPC:** `https://rpc.cc3-testnet.creditcoin.network`
- **Attestcoin Proof Builder URL:** `https://prover.cc3-testnet.creditcoin.network/`
- **Native Block Prover Precompile:** `0x0000000000000000000000000000000000000FD2`

### Package Versions (Pinned)
- `@gluwa/asc-contracts`: `0.2.1`
- `@gluwa/usc-sdk`: `0.18.0`
- `@openzeppelin/contracts`: `5.1.0`
- `hardhat`: `2.28.6`
- `solc`: `0.8.28 (viaIR: true)`

---

## 3. On-Chain Deployments (Hardened Run)

### Source Chain: Ethereum Sepolia
- **Contract:** `MockRecoverySource` (Access-Controlled)
- **Address:** `0x2d2470Ff6eD7563d0109d9C180cc9F1805d09fF9`
- **Deployer / Recovery Authority:** `0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c`
- **Transaction Hash:** `0xb8eee5dac8da599950beb80a236f523519a54d566870833038cdbea14f3204b3`
- **Block Number:** `11697143`
- **Explorer:** [Etherscan Link](https://sepolia.etherscan.io/address/0x2d2470Ff6eD7563d0109d9C180cc9F1805d09fF9)

### Destination Chain: Creditcoin CC3 Testnet
- **Contract:** `SovereignVault`
- **Address:** `0x2d2470Ff6eD7563d0109d9C180cc9F1805d09fF9`
- **Deployer (Owner A):** `0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c`
- **Registered Recovery Source:** `0x2d2470Ff6eD7563d0109d9C180cc9F1805d09fF9`
- **Expected Source Chain Key:** `1` (Sepolia = 1)
- **Transaction Hash:** `0xf8d8ac78e2af9b4218c80d182337e2c8e377e3c7115e6bd8bab85c4126cbbe30`
- **Block Number:** `5481775`

---

## 4. Source Authorization Security Verification

- **Authorized Caller:** `0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c` -> **SUCCESS**
- **Unauthorized Caller:** Random EOA `staticCall` -> **REVERTED on Sepolia** with `UnauthorizedRecoveryAuthority`
- **Real Authorized Sepolia Transaction:**
  - **Tx Hash:** `0x0b076ac2c1242f4905c2a9d4e30f56163051ebe558bbab0a5a0f95884bab9363`
  - **Block Number:** `11697145`
  - **Gas Used:** `25382`
  - **Explorer:** [Etherscan Link](https://sepolia.etherscan.io/tx/0x0b076ac2c1242f4905c2a9d4e30f56163051ebe558bbab0a5a0f95884bab9363)
  - **Emitted Event:**
    ```solidity
    RecoveryAuthorized(
      destinationChainId: 102031,
      destinationAccount: 0x2d2470Ff6eD7563d0109d9C180cc9F1805d09fF9,
      recoveryNonce: 0,
      oldOwner: 0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c,
      newOwner: 0xAE05B00d4bF1ABC3DA94622831AecFBd3539ef21
    )
    ```

---

## 5. Attestcoin Proof Generation

- **Source Block Attestation:** Verified on Creditcoin CC3 via `PrecompileChainInfoProvider.waitUntilHeightAttested(1, 11697145)`
- **Proof Service:** Queried `https://prover.cc3-testnet.creditcoin.network/`
- **Proof Merkle Root:** `0x82b07cedf3eb6a6e0d1e905f9e98d780abee69f60b0bc3887e76f6b4818adbfa`
- **Sibling Count:** `7`
- **Continuity Lower Endpoint:** `0x7458dc3d55090a240f69df48633c4c5fbd079f3220ebb29e6d21bb6d3b31d842`
- **Continuity Roots Count:** `6`
- **Full Proof Artifact:** `evidence/attestcoin_proof.json`

---

## 6. Real Proof Submission & State Transition (Creditcoin CC3)

- **Transaction Hash:** `0x473918051d6590c2e3aeb30f2b5c48d00e54ecfa13b97ac738d61b6c9869f483`
- **Block Number:** `5481810`
- **Gas Used:** `140476`

### State Transition
| Parameter | State Before | State After |
| :--- | :--- | :--- |
| **currentOwner** | `0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c` (Owner A) | `0xAE05B00d4bF1ABC3DA94622831AecFBd3539ef21` (Owner B) |
| **expectedRecoveryNonce** | `0` | `1` |

### Emitted Event on CC3
```solidity
AccountRecovered(
  oldOwner: 0xa11c20b7f5525468b0FACAF6fe246C31F5eB912c,
  newOwner: 0xAE05B00d4bF1ABC3DA94622831AecFBd3539ef21,
  recoveryNonce: 0,
  queryId: 0x42b043bcd9c91f0266ae31573d1f3f397ab1601c723d4bd3d1ae3e45e57525fb
)
```

---

## 7. Replay Attack Verification

- **Replay Submission Attempted:** Same queryId and Merkle inclusion proof.
- **Result:** **REJECTED ON-CHAIN**
- **Observed Revert Message:** `execution reverted: "Query already processed"`
- **Classified Mechanism:** `ASCBase query deduplication (processedQueries[queryId] == true)`

---

## 8. Smart Contract Test Results

All **19** unit & integration tests passed cleanly:
- 4/4 MockRecoverySource unit validations (including authority access control)
- 2/2 Valid recovery flows (direct & sequential)
- 10/10 Invalid recovery, cross-chain, and tamper-resistance scenarios
- 1/1 Internal access-control enforcement (no direct external invocation)

---

## 9. Historical Runs Preserved
- **Run 1 (Initial Transport Proof):** Documented and preserved in `evidence/milestone1b.json` (under `initialTransportRun`) and `evidence/attestcoin_proof_run1.json`.
