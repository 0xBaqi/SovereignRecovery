// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ASCBase } from "@gluwa/asc-contracts/contracts/readability/ASCBase.sol";
import { EvmV1Decoder } from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

/**
 * @title SovereignVault
 * @notice Deterministic sovereign account recovery vault powered by Gluwa Attestcoin (ASC).
 * @dev Inherits ASCBase for proof-of-inclusion verification via the Creditcoin block-prover precompile (0xFD2).
 *      Recovery execution is strictly internal and can only be triggered via a verified Attestcoin proof
 *      cryptographically bound to the configured source chainKey (e.g. Sepolia = 1).
 */
contract SovereignVault is ASCBase {
    /// @notice Normalized recovery authorization payload extracted from verified source-chain log.
    struct RecoveryAuthorization {
        address sourceEmitter;
        uint256 destinationChainId;
        address destinationAccount;
        uint256 recoveryNonce;
        address oldOwner;
        address newOwner;
    }

    /// @notice Event signature for RecoveryAuthorized(uint256,address,uint256,address,address)
    bytes32 public constant RECOVERY_AUTHORIZED_SIGNATURE =
        keccak256("RecoveryAuthorized(uint256,address,uint256,address,address)");

    // --- State Variables ---
    address public currentOwner;
    address public registeredRecoverySource;
    uint256 public expectedRecoveryNonce;
    uint64 public immutable expectedSourceChainKey;

    // --- Events ---
    event AccountRecovered(
        address indexed oldOwner,
        address indexed newOwner,
        uint256 recoveryNonce,
        bytes32 queryId
    );

    // --- Custom Errors ---
    error ZeroAddress();
    error UnauthorizedSourceEmitter(address actualEmitter, address expectedEmitter);
    error InvalidSourceChain(uint64 actualChainKey, uint64 expectedChainKey);
    error SourceTransactionFailed(uint8 receiptStatus);
    error RecoveryAuthorizedLogNotFound();
    error InvalidLogFormat();
    error InvalidDestinationChain(uint256 actualChainId, uint256 expectedChainId);
    error WrongDestinationAccount(address actualAccount, address expectedAccount);
    error InvalidRecoveryNonce(uint256 actualNonce, uint256 expectedNonce);
    error WrongOldOwner(address actualOldOwner, address expectedOldOwner);
    error ZeroNewOwner();
    error IdenticalNewOwner();

    /**
     * @notice Initializes the SovereignVault with an initial owner and authorized recovery root.
     * @param _initialOwner The initial owner of the vault (Owner A).
     * @param _registeredRecoverySource The authorized source contract (e.g. MockRecoverySource on Sepolia).
     * @param _expectedSourceChainKey The Attestcoin source chainKey (must be non-zero, e.g. Sepolia = 1).
     */
    constructor(
        address _initialOwner,
        address _registeredRecoverySource,
        uint64 _expectedSourceChainKey
    ) ASCBase() {
        if (_initialOwner == address(0)) revert ZeroAddress();
        if (_registeredRecoverySource == address(0)) revert ZeroAddress();
        if (_expectedSourceChainKey == 0) revert InvalidSourceChain(0, 1);

        currentOwner = _initialOwner;
        registeredRecoverySource = _registeredRecoverySource;
        expectedRecoveryNonce = 0;
        expectedSourceChainKey = _expectedSourceChainKey;
    }

    /**
     * @notice Extracts the source chainKey passed to `ASCBase.execute(...)` from calldata.
     * @dev Function selector: 4 bytes. Param 0 (action): bytes 4..35. Param 1 (chainKey): bytes 36..67.
     *      Cleanses upper bits via uint64 typecast.
     */
    function _extractSourceChainKey() internal pure returns (uint64 key) {
        if (msg.data.length >= 68) {
            uint256 rawWord;
            assembly {
                rawWord := calldataload(36)
            }
            key = uint64(rawWord);
        }
    }

    /**
     * @notice ASCBase hook invoked strictly after proof verification and queryId deduplication.
     * @param action Caller-supplied action discriminator.
     * @param queryId Stable identifier for the proved transaction.
     * @param encodedTransaction Prover tx bytes containing chunks: common tx, type-specific, receipt.
     */
    function _processAndEmitEvent(
        uint8 action,
        bytes32 queryId,
        bytes memory encodedTransaction
    ) internal override {
        // Suppress unused variable warning for action discriminator
        action;

        // 1. Cryptographically bind recovery to the configured expected source chainKey
        uint64 sourceChainKey = _extractSourceChainKey();
        if (sourceChainKey != expectedSourceChainKey) {
            revert InvalidSourceChain(sourceChainKey, expectedSourceChainKey);
        }

        // 2. Decode receipt fields using EvmV1Decoder
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) {
            revert SourceTransactionFailed(receipt.receiptStatus);
        }

        // 3. Filter logs by RecoveryAuthorized event signature
        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder.getLogsByEventSignature(
            receipt,
            RECOVERY_AUTHORIZED_SIGNATURE
        );
        if (logs.length == 0) {
            revert RecoveryAuthorizedLogNotFound();
        }

        // 4. Locate and parse the authorization log for this vault
        bool found = false;
        RecoveryAuthorization memory auth;

        for (uint256 i = 0; i < logs.length; i++) {
            EvmV1Decoder.LogEntry memory logEntry = logs[i];
            if (logEntry.topics.length >= 4) {
                address destAcc = address(uint160(uint256(logEntry.topics[1])));
                if (destAcc == address(this) && logEntry.address_ == registeredRecoverySource) {
                    (uint256 destChainId, uint256 nonce) = abi.decode(logEntry.data, (uint256, uint256));
                    address oldOwn = address(uint160(uint256(logEntry.topics[2])));
                    address newOwn = address(uint160(uint256(logEntry.topics[3])));

                    auth = RecoveryAuthorization({
                        sourceEmitter: logEntry.address_,
                        destinationChainId: destChainId,
                        destinationAccount: destAcc,
                        recoveryNonce: nonce,
                        oldOwner: oldOwn,
                        newOwner: newOwn
                    });
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            // Diagnostic checks to provide accurate revert reason
            EvmV1Decoder.LogEntry memory firstLog = logs[0];
            if (firstLog.address_ != registeredRecoverySource) {
                revert UnauthorizedSourceEmitter(firstLog.address_, registeredRecoverySource);
            }
            if (firstLog.topics.length < 4) {
                revert InvalidLogFormat();
            }
            address targetAccount = address(uint160(uint256(firstLog.topics[1])));
            revert WrongDestinationAccount(targetAccount, address(this));
        }

        // 5. Enforce recovery policy strictly through internal function
        _processRecovery(auth, queryId);
    }

    /**
     * @notice Deterministic recovery policy engine.
     * @dev CRITICAL ACCESS-CONTROL: This function is INTERNAL and cannot be invoked directly.
     *      All state transitions must pass through Attestcoin proof verification in ASCBase.
     */
    function _processRecovery(
        RecoveryAuthorization memory auth,
        bytes32 queryId
    ) internal {
        // 1. Enforce source emitter
        if (auth.sourceEmitter != registeredRecoverySource) {
            revert UnauthorizedSourceEmitter(auth.sourceEmitter, registeredRecoverySource);
        }

        // 2. Enforce destination chain ID matches current chain
        if (auth.destinationChainId != block.chainid) {
            revert InvalidDestinationChain(auth.destinationChainId, block.chainid);
        }

        // 3. Enforce destination account is this vault
        if (auth.destinationAccount != address(this)) {
            revert WrongDestinationAccount(auth.destinationAccount, address(this));
        }

        // 4. Enforce recovery nonce is strictly sequential
        if (auth.recoveryNonce != expectedRecoveryNonce) {
            revert InvalidRecoveryNonce(auth.recoveryNonce, expectedRecoveryNonce);
        }

        // 5. Enforce old owner matches current owner
        if (auth.oldOwner != currentOwner) {
            revert WrongOldOwner(auth.oldOwner, currentOwner);
        }

        // 6. Enforce new owner is non-zero
        if (auth.newOwner == address(0)) {
            revert ZeroNewOwner();
        }

        // 7. Enforce new owner is different from current owner
        if (auth.newOwner == currentOwner) {
            revert IdenticalNewOwner();
        }

        // State transition
        address previousOwner = currentOwner;
        currentOwner = auth.newOwner;
        expectedRecoveryNonce++;

        emit AccountRecovered(previousOwner, auth.newOwner, auth.recoveryNonce, queryId);
    }
}
