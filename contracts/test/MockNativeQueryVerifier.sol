// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { INativeQueryVerifier } from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/**
 * @title MockNativeQueryVerifier
 * @notice Test mock deployed to 0xFD2 in local Hardhat environment to simulate the Creditcoin precompile.
 * @dev Stateless implementation to ensure hardhat_setCode at 0xFD2 functions correctly without storage dependencies.
 */
contract MockNativeQueryVerifier is INativeQueryVerifier {
    function verifyAndEmit(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external override returns (bool) {
        return true;
    }

    function verifyAndEmit(
        uint64,
        uint64[] calldata,
        bytes[] calldata,
        MerkleProof[] calldata,
        ContinuityProof calldata
    ) external override returns (bool) {
        return true;
    }

    function verify(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external pure override returns (bool) {
        return true;
    }

    function verify(
        uint64,
        uint64[] calldata,
        bytes[] calldata,
        MerkleProof[] calldata,
        ContinuityProof calldata
    ) external pure override returns (bool) {
        return true;
    }

    function calculateTxIndex(
        MerkleProof calldata
    ) external pure override returns (uint64) {
        return 0;
    }
}
