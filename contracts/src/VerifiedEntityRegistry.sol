// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IVerifiedEntityRegistry} from "./interfaces/IVerifiedEntityRegistry.sol";

/// @title VerifiedEntityRegistry
/// @notice Binds wallet addresses to verified real-world entities.
///
/// @dev This contract is the one deliberately centralised component of the system, and it is
///      built to be honest about that rather than to disguise it.
///
///      What verification means here is narrow and objective: a verifier confirms that the
///      entity controls its already-established public identity and has publicly bound this
///      wallet address to it (an announcement on its own domain, its verified social account,
///      a press release). It is proof-of-control, not a judgement about whether an applicant
///      seems trustworthy. `proofURI` is stored on-chain precisely so that a sceptical donor
///      can re-check the claim themselves instead of trusting that a verifier did their job.
///
///      No single address can grant or revoke institutional identity. Every privileged action
///      requires `threshold` confirmations from distinct verifiers. The verifier set governs
///      itself under the same rule: there is no owner, no admin, and no deployer privilege
///      that survives construction.
contract VerifiedEntityRegistry is IVerifiedEntityRegistry {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum RequestStatus {
        None,
        Pending,
        Approved,
        Rejected,
        Withdrawn
    }

    struct Request {
        address applicant;
        string name;
        string proofURI;
        EntityType entityType;
        uint96 feePaid;
        uint64 submittedAt;
        RequestStatus status;
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotVerifier();
    error AlreadyExecuted();
    error IncorrectFee(uint256 required, uint256 provided);
    error EmptyName();
    error EmptyProof();
    error InvalidEntityType();
    error ZeroAddress();
    error AlreadyVerified(address account);
    error RequestNotPending(uint256 requestId);
    error NotApplicant();
    error RequestAlreadyConfirmed();
    error NotVerifiedEntity(address account);
    error InvalidThreshold(uint256 threshold, uint256 verifierCount);
    error VerifierExists(address account);
    error VerifierMissing(address account);
    error NoVerifiers();
    error TransferFailed();
    error NothingToWithdraw();

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event VerificationRequested(
        uint256 indexed requestId, address indexed applicant, EntityType entityType, string name, string proofURI
    );
    event RequestWithdrawn(uint256 indexed requestId, address indexed applicant, uint256 refund);
    event OperationConfirmed(bytes32 indexed opHash, address indexed verifier, uint256 confirmations);
    event EntityVerified(
        address indexed account,
        uint256 indexed requestId,
        EntityType entityType,
        string name,
        string proofURI,
        address verifiedBy
    );
    event RequestRejected(uint256 indexed requestId, address indexed applicant, string reason);
    event VerificationRevoked(address indexed account, string reason, address revokedBy);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    event ThresholdChanged(uint256 previousThreshold, uint256 newThreshold);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Anti-spam deposit, denominated in the native gas token so that the registry
    ///         carries no dependency on any ERC-20. It exists to make impersonation attempts
    ///         cost something, not to raise revenue.
    uint256 public immutable verificationFee;

    mapping(address account => Entity) private _entities;

    /// @dev Enumerable set of currently-active verified accounts, so the dApp can list
    ///      institutions without scanning event logs. The public mainnet RPC restricts
    ///      eth_getLogs, so on-chain enumeration is a requirement, not a convenience.
    address[] private _verifiedAccounts;
    mapping(address account => uint256 indexPlusOne) private _verifiedIndex;

    Request[] private _requests;
    mapping(address applicant => uint256[] requestIds) private _requestsByApplicant;

    /// @dev Bumped every time an account's verification status changes, so that a revoke
    ///      operation hash for the same account cannot be replayed across epochs.
    mapping(address account => uint256) public entityEpoch;

    mapping(address account => bool) public isVerifier;
    address[] private _verifiers;
    mapping(address verifier => uint256 indexPlusOne) private _verifierIndex;

    /// @notice Confirmations required for any privileged action.
    uint256 public threshold;

    /// @dev Serialises verifier-set and treasury operations. Only one such operation may be
    ///      in flight at a time; verifiers coordinate off-chain, as multisig signers already do.
    uint256 public governanceNonce;

    mapping(bytes32 opHash => uint256) public confirmationCount;
    mapping(bytes32 opHash => mapping(address verifier => bool)) public hasConfirmed;
    mapping(bytes32 opHash => bool) public opExecuted;

    /// @notice Fees collected from approved and rejected applications, withdrawable only by
    ///         a threshold of verifiers.
    uint256 public collectedFees;

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    constructor(address[] memory initialVerifiers, uint256 initialThreshold, uint256 fee) {
        uint256 count = initialVerifiers.length;
        if (count == 0) revert NoVerifiers();
        if (initialThreshold == 0 || initialThreshold > count) {
            revert InvalidThreshold(initialThreshold, count);
        }

        for (uint256 i = 0; i < count; ++i) {
            address verifier = initialVerifiers[i];
            if (verifier == address(0)) revert ZeroAddress();
            if (isVerifier[verifier]) revert VerifierExists(verifier);
            isVerifier[verifier] = true;
            _verifiers.push(verifier);
            _verifierIndex[verifier] = _verifiers.length;
            emit VerifierAdded(verifier);
        }

        threshold = initialThreshold;
        verificationFee = fee;
        emit ThresholdChanged(0, initialThreshold);
    }

    // ---------------------------------------------------------------------
    // Applicant flow
    // ---------------------------------------------------------------------

    /// @notice Submit this wallet for verification as a real-world entity.
    /// @param name       The entity's publicly-known name, exactly as it appears in the proof.
    /// @param entityType What kind of entity this is.
    /// @param proofURI   Where the public proof of control can be read. This is the value a
    ///                   donor clicks through to, so it must resolve to something anyone can
    ///                   verify independently.
    function requestVerification(string calldata name, EntityType entityType, string calldata proofURI)
        external
        payable
        returns (uint256 requestId)
    {
        if (msg.value != verificationFee) revert IncorrectFee(verificationFee, msg.value);
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(proofURI).length == 0) revert EmptyProof();
        if (entityType == EntityType.Unspecified) revert InvalidEntityType();
        if (_entities[msg.sender].active) revert AlreadyVerified(msg.sender);

        requestId = _requests.length;
        _requests.push(
            Request({
                applicant: msg.sender,
                name: name,
                proofURI: proofURI,
                entityType: entityType,
                feePaid: uint96(msg.value),
                submittedAt: uint64(block.timestamp),
                status: RequestStatus.Pending
            })
        );
        _requestsByApplicant[msg.sender].push(requestId);

        emit VerificationRequested(requestId, msg.sender, entityType, name, proofURI);
    }

    /// @notice Withdraw a pending application and reclaim the fee.
    /// @dev Only possible while no verifier has spent effort on it. Once review has begun the
    ///      fee is consumed either way, which is what makes it a deterrent rather than a
    ///      free retry loop for impersonators.
    function withdrawRequest(uint256 requestId) external {
        Request storage request = _requests[requestId];
        if (request.status != RequestStatus.Pending) revert RequestNotPending(requestId);
        if (request.applicant != msg.sender) revert NotApplicant();
        if (confirmationCount[_approveOpHash(requestId)] != 0) revert RequestAlreadyConfirmed();

        request.status = RequestStatus.Withdrawn;
        uint256 refund = request.feePaid;
        request.feePaid = 0;

        emit RequestWithdrawn(requestId, msg.sender, refund);

        if (refund != 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ---------------------------------------------------------------------
    // Verifier flow
    // ---------------------------------------------------------------------

    /// @notice Confirm an application. Executes once `threshold` distinct verifiers agree.
    function approveRequest(uint256 requestId) external {
        Request storage request = _requests[requestId];
        if (request.status != RequestStatus.Pending) revert RequestNotPending(requestId);

        if (!_confirm(_approveOpHash(requestId))) return;

        address applicant = request.applicant;
        if (_entities[applicant].active) revert AlreadyVerified(applicant);

        request.status = RequestStatus.Approved;
        collectedFees += request.feePaid;

        _entities[applicant] = Entity({
            name: request.name,
            proofURI: request.proofURI,
            entityType: request.entityType,
            verifiedAt: uint64(block.timestamp),
            verifiedBy: msg.sender,
            active: true
        });

        _verifiedAccounts.push(applicant);
        _verifiedIndex[applicant] = _verifiedAccounts.length;
        unchecked {
            ++entityEpoch[applicant];
        }

        emit EntityVerified(
            applicant, requestId, request.entityType, request.name, request.proofURI, msg.sender
        );
    }

    /// @notice Reject an application. The fee is consumed.
    function rejectRequest(uint256 requestId, string calldata reason) external {
        Request storage request = _requests[requestId];
        if (request.status != RequestStatus.Pending) revert RequestNotPending(requestId);

        if (!_confirm(keccak256(abi.encode("REJECT", requestId)))) return;

        request.status = RequestStatus.Rejected;
        collectedFees += request.feePaid;

        emit RequestRejected(requestId, request.applicant, reason);
    }

    /// @notice Revoke an active verification.
    /// @dev Necessary rather than optional: a verification system with no revocation path is
    ///      one bad approval away from being permanently wrong. Downstream contracts are
    ///      expected to treat revocation as disqualifying at the moment value moves.
    function revokeVerification(address account, string calldata reason) external {
        if (!_entities[account].active) revert NotVerifiedEntity(account);

        if (!_confirm(keccak256(abi.encode("REVOKE", account, entityEpoch[account])))) return;

        _entities[account].active = false;
        unchecked {
            ++entityEpoch[account];
        }
        _removeVerifiedAccount(account);

        emit VerificationRevoked(account, reason, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Verifier-set governance (self-governing; no owner exists)
    // ---------------------------------------------------------------------

    function addVerifier(address verifier) external {
        if (verifier == address(0)) revert ZeroAddress();
        if (isVerifier[verifier]) revert VerifierExists(verifier);

        if (!_confirm(keccak256(abi.encode("ADD_VERIFIER", verifier, governanceNonce)))) return;

        unchecked {
            ++governanceNonce;
        }
        isVerifier[verifier] = true;
        _verifiers.push(verifier);
        _verifierIndex[verifier] = _verifiers.length;

        emit VerifierAdded(verifier);
    }

    /// @notice Remove a verifier, optionally lowering the threshold in the same operation.
    /// @dev `newThreshold` is explicit so the set can never be left in a state where the
    ///      threshold exceeds the number of verifiers and the registry deadlocks.
    function removeVerifier(address verifier, uint256 newThreshold) external {
        if (!isVerifier[verifier]) revert VerifierMissing(verifier);

        uint256 remaining = _verifiers.length - 1;
        if (remaining == 0) revert NoVerifiers();
        if (newThreshold == 0 || newThreshold > remaining) {
            revert InvalidThreshold(newThreshold, remaining);
        }

        if (!_confirm(keccak256(abi.encode("REMOVE_VERIFIER", verifier, newThreshold, governanceNonce)))) {
            return;
        }

        unchecked {
            ++governanceNonce;
        }
        isVerifier[verifier] = false;
        _removeVerifier(verifier);

        uint256 previous = threshold;
        if (previous != newThreshold) {
            threshold = newThreshold;
            emit ThresholdChanged(previous, newThreshold);
        }

        emit VerifierRemoved(verifier);
    }

    function setThreshold(uint256 newThreshold) external {
        uint256 count = _verifiers.length;
        if (newThreshold == 0 || newThreshold > count) revert InvalidThreshold(newThreshold, count);

        if (!_confirm(keccak256(abi.encode("SET_THRESHOLD", newThreshold, governanceNonce)))) return;

        unchecked {
            ++governanceNonce;
        }
        uint256 previous = threshold;
        threshold = newThreshold;

        emit ThresholdChanged(previous, newThreshold);
    }

    function withdrawFees(address to) external {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = collectedFees;
        if (amount == 0) revert NothingToWithdraw();

        if (!_confirm(keccak256(abi.encode("WITHDRAW_FEES", to, amount, governanceNonce)))) return;

        unchecked {
            ++governanceNonce;
        }
        collectedFees = 0;

        emit FeesWithdrawn(to, amount);

        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function isVerified(address account) external view returns (bool) {
        return _entities[account].active;
    }

    function entityOf(address account) external view returns (Entity memory) {
        return _entities[account];
    }

    function verifierCount() external view returns (uint256) {
        return _verifiers.length;
    }

    function verifiers() external view returns (address[] memory) {
        return _verifiers;
    }

    function verifiedCount() external view returns (uint256) {
        return _verifiedAccounts.length;
    }

    /// @notice Paginated listing of active verified accounts.
    function verifiedAccounts(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 total = _verifiedAccounts.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _verifiedAccounts[i];
        }
    }

    function requestCount() external view returns (uint256) {
        return _requests.length;
    }

    function getRequest(uint256 requestId) external view returns (Request memory) {
        return _requests[requestId];
    }

    function requestsOf(address applicant) external view returns (uint256[] memory) {
        return _requestsByApplicant[applicant];
    }

    /// @notice Confirmation progress for a pending application, for verifier dashboards.
    function approvalProgress(uint256 requestId)
        external
        view
        returns (uint256 confirmations, uint256 required)
    {
        return (confirmationCount[_approveOpHash(requestId)], threshold);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _approveOpHash(uint256 requestId) private pure returns (bytes32) {
        return keccak256(abi.encode("APPROVE", requestId));
    }

    /// @dev Records a confirmation and reports whether the operation may now execute.
    ///      Returning false rather than reverting lets the first `threshold - 1` verifiers
    ///      call the same function with the same arguments; only the last one does the work.
    function _confirm(bytes32 opHash) private returns (bool) {
        if (!isVerifier[msg.sender]) revert NotVerifier();
        if (opExecuted[opHash]) revert AlreadyExecuted();

        if (!hasConfirmed[opHash][msg.sender]) {
            hasConfirmed[opHash][msg.sender] = true;
            uint256 count;
            unchecked {
                count = ++confirmationCount[opHash];
            }
            emit OperationConfirmed(opHash, msg.sender, count);
        }

        if (confirmationCount[opHash] >= threshold) {
            opExecuted[opHash] = true;
            return true;
        }
        return false;
    }

    function _removeVerifiedAccount(address account) private {
        uint256 indexPlusOne = _verifiedIndex[account];
        if (indexPlusOne == 0) return;
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _verifiedAccounts.length - 1;
        if (index != lastIndex) {
            address moved = _verifiedAccounts[lastIndex];
            _verifiedAccounts[index] = moved;
            _verifiedIndex[moved] = indexPlusOne;
        }
        _verifiedAccounts.pop();
        _verifiedIndex[account] = 0;
    }

    function _removeVerifier(address verifier) private {
        uint256 indexPlusOne = _verifierIndex[verifier];
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _verifiers.length - 1;
        if (index != lastIndex) {
            address moved = _verifiers[lastIndex];
            _verifiers[index] = moved;
            _verifierIndex[moved] = indexPlusOne;
        }
        _verifiers.pop();
        _verifierIndex[verifier] = 0;
    }
}
