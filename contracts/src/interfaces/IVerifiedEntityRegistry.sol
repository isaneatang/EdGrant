// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IVerifiedEntityRegistry
/// @notice Read interface for the identity layer. Consumers should depend only on this,
///         never on the registry implementation, so the registry can be replaced or
///         reimplemented without touching downstream contracts.
interface IVerifiedEntityRegistry {
    enum EntityType {
        Unspecified,
        School,
        Company,
        Institution,
        Other
    }

    struct Entity {
        /// @notice Publicly claimed real-world name of the entity.
        string name;
        /// @notice Reference to the entity's public proof of control over this address.
        ///         Anyone must be able to re-check this without trusting a verifier.
        string proofURI;
        EntityType entityType;
        /// @notice Unix timestamp at which verification was granted.
        uint64 verifiedAt;
        /// @notice The verifier whose confirmation carried the approval past threshold.
        address verifiedBy;
        /// @notice False once verification has been revoked.
        bool active;
    }

    /// @notice The single question downstream contracts need answered.
    function isVerified(address account) external view returns (bool);

    /// @notice Full record, including revoked entities. Check `active` before relying on it.
    function entityOf(address account) external view returns (Entity memory);
}
