# Gluwa ASC & USC-SDK API Notes

*Discovered directly from installed source packages: `@gluwa/asc-contracts@0.2.1` and `@gluwa/usc-sdk@0.18.0`.*

---

## 1. ASCBase (`@gluwa/asc-contracts/contracts/readability/ASCBase.sol`)

### Constructor
```solidity
constructor() {
    VERIFIER = NativeQueryVerifierLib.getVerifier();
}
```
- No arguments required.
- Initializes immutable `VERIFIER` (`INativeQueryVerifier`) pointing to precompile address `0x0000000000000000000000000000000000000FD2` (`0xFD2` / 4050).

### `execute(...)` Signature
```solidity
function execute(
    uint8 action,
    uint64 chainKey,
    uint64 blockHeight,
    bytes calldata encodedTransaction,
    bytes32 merkleRoot,
    INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
    bytes32 lowerEndpointDigest,
    bytes32[] calldata continuityRoots
) external returns (bool success)
```
- Non-virtual external entry point.
- Replay protection: `processedQueries[queryId]` is checked and set to `true`.
- Calls `_verifyProof(...)` against `VERIFIER.verifyAndEmit(...)`.
- Calls `_processAndEmitEvent(action, queryId, encodedTransaction)`.

### `_processAndEmitEvent(...)` Hook Signature
```solidity
function _processAndEmitEvent(
    uint8 action,
    bytes32 queryId,
    bytes memory encodedTransaction
) internal virtual;
```
- Must be implemented by the inheriting contract (e.g. `SovereignVault`).
- `action`: caller-supplied discriminator.
- `queryId`: stable deterministic identifier computed from `(chainKey, blockHeight, txIndex)`.
- `encodedTransaction`: raw proved transaction bytes containing chunks `[commonTx, typeSpecific, receipt]`.

### Query ID Derivation
```solidity
function _computeQueryId(
    uint64 chainKey,
    uint64 blockHeight,
    bytes32 merkleRoot,
    INativeQueryVerifier.MerkleProofEntry[] calldata siblings
) internal view returns (bytes32 queryId)
```
- Calculates `txIndex` via `VERIFIER.calculateTxIndex(merkleProof)`.
- Computes `keccak256` of `chainKey` (32-byte word) + `blockHeight` (shifted to 8 bytes) + `txIndex` (32 bytes) = 72 bytes.

### Precompile Replay Protection
- `ASCBase` tracks `mapping(bytes32 => bool) public processedQueries`.
- Reverts with `"Query already processed"` if replayed.

---

## 2. EvmV1Decoder (`@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol`)

### Structs
```solidity
struct LogEntry {
    address address_;   // NOTE: trailing underscore!
    bytes32[] topics;
    bytes data;
}

struct ReceiptFields {
    uint8 receiptStatus;      // 1 = success, 0 = reverted
    uint64 receiptGasUsed;
    LogEntry[] receiptLogs;
    bytes receiptLogsBloom;
}

struct CommonTxFields {
    uint64 nonce;
    uint64 gasLimit;
    address from;
    bool toIsNull;
    address to;
    uint256 value;
    bytes data;
}
```

### Key Decoder APIs
- `decodeReceiptFields(bytes memory encodedTx) internal pure returns (ReceiptFields memory)`
  - Decodes `receiptStatus`, `receiptGasUsed`, `receiptLogs`, and `receiptLogsBloom`.
- `getLogsByEventSignature(ReceiptFields memory receipt, bytes32 eventSignature) internal pure returns (LogEntry[] memory)`
  - Filters logs by `topics[0] == eventSignature`.
- `decodeCommonTxFields(bytes memory encodedTx) internal pure returns (CommonTxFields memory)`
  - Decodes transaction sender (`from`), target (`to`), nonce, value, data.

### Emitter Address & Topics
- In `LogEntry`:
  - `log.address_` is the emitting contract address (e.g. `registeredRecoverySource`).
  - `log.topics[0]` is the event signature hash: `keccak256("RecoveryAuthorized(uint256,address,uint256,address,address)")`.
  - Indexed parameters appear in order:
    - `log.topics[1]` = `bytes32(uint256(uint160(destinationAccount)))`
    - `log.topics[2]` = `bytes32(uint256(uint160(oldOwner)))`
    - `log.topics[3]` = `bytes32(uint256(uint160(newOwner)))`
  - Unindexed parameters appear in `log.data`:
    - `abi.decode(log.data, (uint256, uint256))` -> `(destinationChainId, recoveryNonce)`

---

## 3. Native Query Verifier Precompile (`0xFD2` / 4050)
- Defined in `@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol`.
- Address: `0x0000000000000000000000000000000000000FD2`.
- Validates binary Merkle tree inclusion proof of transaction within the attested block.
- Validates block continuity proof connecting the block to the attested continuity bounds.

---

## 4. USC SDK (`@gluwa/usc-sdk@0.18.0`)

### Proof Generation Flow
```typescript
import { proofProvider, chainInfo } from '@gluwa/usc-sdk';
import { JsonRpcProvider } from 'ethers';

// 1. Wait until block is attested on Creditcoin CC3
const provider = new JsonRpcProvider(creditcoinRpcUrl);
const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(provider);
await chainInfoProvider.waitUntilHeightAttested(chainKey, blockHeight);

// 2. Request proof from ProofBuilder service
const builder = new proofProvider.service.ProofBuilder(chainKey, proofBuilderUrl);
const proofResult = await builder.getProof(txHash);

// proofResult.data contains:
// - chainKey: number
// - headerNumber: number
// - txIndex: number
// - txHash: string
// - txBytes: string (hex)
// - merkleProof: { root: string, siblings: { hash: string, isLeft: boolean }[] }
// - continuityProof: { lowerEndpointDigest: string, roots: string[] }
```

### Proof Submission to ASCBase Contract
```typescript
await sovereignVault.execute(
    action, // e.g. 0
    proofData.chainKey,
    proofData.headerNumber,
    proofData.txBytes,
    proofData.merkleProof.root,
    proofData.merkleProof.siblings,
    proofData.continuityProof.lowerEndpointDigest,
    proofData.continuityProof.roots
);
```
