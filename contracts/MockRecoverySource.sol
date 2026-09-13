// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MockRecoverySource
 * @notice Milestone 1 source-chain recovery authorization contract for SovereignRecovery.
 * @dev Emits an explicit RecoveryAuthorized event bound to destination chain, account, nonce, and owners.
 *      Access is restricted strictly to an authorized recovery authority (e.g. cold key, guardian, or multi-sig).
 *      Safe integration is planned for subsequent production milestones.
 */
contract MockRecoverySource {
    event RecoveryAuthorized(
        uint256 destinationChainId,
        address indexed destinationAccount,
        uint256 recoveryNonce,
        address indexed oldOwner,
        address indexed newOwner
    );

    error InvalidDestinationChain();
    error ZeroAddress();
    error IdenticalOwners();
    error UnauthorizedRecoveryAuthority(address caller, address expectedAuthority);

    /// @notice The designated recovery authority permitted to initiate recovery authorizations.
    address public immutable recoveryAuthority;

    modifier onlyRecoveryAuthority() {
        if (msg.sender != recoveryAuthority) {
            revert UnauthorizedRecoveryAuthority(msg.sender, recoveryAuthority);
        }
        _;
    }

    /**
     * @notice Initializes MockRecoverySource with a designated recovery authority.
     * @param _recoveryAuthority The address authorized to trigger recovery (e.g. guardian or owner).
     */
    constructor(address _recoveryAuthority) {
        if (_recoveryAuthority == address(0)) revert ZeroAddress();
        recoveryAuthority = _recoveryAuthority;
    }

    /**
     * @notice Authorizes an account recovery on a destination chain.
     * @dev Restricted strictly to recoveryAuthority.
     * @param destinationChainId Target EVM chain ID where recovery is to be executed (e.g. Creditcoin CC3).
     * @param destinationAccount Address of the account/vault on the destination chain.
     * @param recoveryNonce Sequential recovery nonce for this account.
     * @param oldOwner Current owner address expected to be replaced.
     * @param newOwner Designated new owner address.
     */
    function authorizeRecovery(
        uint256 destinationChainId,
        address destinationAccount,
        uint256 recoveryNonce,
        address oldOwner,
        address newOwner
    ) external onlyRecoveryAuthority {
        if (destinationChainId == 0) revert InvalidDestinationChain();
        if (destinationAccount == address(0)) revert ZeroAddress();
        if (oldOwner == address(0) || newOwner == address(0)) revert ZeroAddress();
        if (oldOwner == newOwner) revert IdenticalOwners();

        emit RecoveryAuthorized(
            destinationChainId,
            destinationAccount,
            recoveryNonce,
            oldOwner,
            newOwner
        );
    }
}
