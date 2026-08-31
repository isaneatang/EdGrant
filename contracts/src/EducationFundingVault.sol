// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IVerifiedEntityRegistry} from "./interfaces/IVerifiedEntityRegistry.sol";

/// @title EducationFundingVault
/// @notice Crowdfunds outstanding school fees such that the money never passes through the
///         student, and can only ever reach the verified institution that is owed it.
///
/// @dev The design intent, stated plainly so that future changes can be measured against it:
///
///      1. Funds go from contributor -> vault -> verified school. There is no third
///         destination. The student has no ability to receive, redirect, or spend anything,
///         which removes the mechanism by which the common form of crowdfunding fraud occurs.
///      2. There is no administrative override, no pause, no deployer privilege, and no way to
///         cancel a request or seize contributions. If a change ever seems to require one,
///         the change is wrong.
///      3. Refunds are individual and pull-based. Nothing is ever swept, and no unclaimed
///         balance accumulates anywhere.
///      4. Verification is re-checked at the moment value moves, not only at creation. A
///         school whose verification has been revoked cannot be paid; its contributors can
///         withdraw immediately, without waiting for the deadline. Revocation therefore fails
///         in the only safe direction: money returns to the people who sent it.
///
///      Amounts are denominated in an ERC-20 stable unit fixed at deployment. School fees are
///      fiat-denominated debts, so a goal expressed in a volatile asset would drift away from
///      the balance it is meant to settle before the deadline arrives.
contract EducationFundingVault is ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct FundingRequest {
        /// @notice The verified institution that is owed the fees and that will receive them.
        address school;
        /// @notice Opaque identifier meaningful only inside the school's own records.
        ///         Never a legal name. Personally identifying information stays off-chain.
        bytes32 studentRef;
        uint128 goal;
        uint128 raised;
        uint64 createdAt;
        uint64 deadline;
        bool disbursed;
    }

    /// @notice Optional public context a student chooses to share. The mechanism works fully
    ///         without it, and nothing here is required to fund a request.
    struct StudentContext {
        string pseudonym;
        string statement;
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error ZeroAddress();
    error SchoolNotVerified(address school);
    error ZeroGoal();
    error DeadlineTooSoon(uint64 deadline, uint256 earliest);
    error DeadlineTooFar(uint64 deadline, uint256 latest);
    error UnknownRequest(uint256 requestId);
    error RequestClosed(uint256 requestId);
    error DeadlinePassed(uint256 requestId);
    error ZeroContribution();
    error ExceedsRemaining(uint256 remaining);
    error GoalNotReached(uint256 raised, uint256 goal);
    error AlreadyDisbursed(uint256 requestId);
    error NotRefundable(uint256 requestId);
    error NothingToRefund();
    error NotSchool();

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event RequestCreated(
        uint256 indexed requestId,
        address indexed school,
        bytes32 indexed studentRef,
        uint256 goal,
        uint64 deadline
    );
    event ContextUpdated(uint256 indexed requestId, string pseudonym, string statement);
    event ContributionReceived(
        uint256 indexed requestId, address indexed contributor, uint256 amount, uint256 totalRaised
    );
    event GoalReached(uint256 indexed requestId, uint256 goal, uint64 reachedAt);
    event FundsDisbursed(uint256 indexed requestId, address indexed school, uint256 amount);
    event RefundClaimed(uint256 indexed requestId, address indexed contributor, uint256 amount);

    // ---------------------------------------------------------------------
    // Immutables
    // ---------------------------------------------------------------------

    /// @notice The identity layer. Queried, never written to, and fixed at deployment.
    IVerifiedEntityRegistry public immutable registry;

    /// @notice The stable unit all goals and contributions are denominated in.
    IERC20 public immutable token;

    uint64 public constant MIN_DURATION = 1 days;
    uint64 public constant MAX_DURATION = 365 days;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    FundingRequest[] private _requests;
    mapping(uint256 requestId => StudentContext) private _context;

    mapping(uint256 requestId => mapping(address contributor => uint256)) private _contributions;
    mapping(uint256 requestId => address[] contributors) private _contributors;

    mapping(address school => uint256[] requestIds) private _requestsBySchool;

    /// @dev Enumerated on-chain because the public mainnet RPC restricts eth_getLogs. The
    ///      dApp must stay fully functional using only view calls; events exist for
    ///      auditability and indexers, not as the primary read path.
    mapping(address contributor => uint256[] requestIds) private _requestsByContributor;

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    constructor(IVerifiedEntityRegistry registry_, IERC20 token_) {
        if (address(registry_) == address(0) || address(token_) == address(0)) revert ZeroAddress();
        registry = registry_;
        token = token_;
    }

    // ---------------------------------------------------------------------
    // School flow
    // ---------------------------------------------------------------------

    /// @notice Attest that a student owes fees, and open the balance for contribution.
    /// @dev Callable only by a currently-verified entity. The claim being recorded is not
    ///      "this student deserves help", which is an unverifiable judgement, but "this school says
    ///      this student owes this amount", made by the party that would be owed the money,
    ///      from its own verified address.
    function createRequest(bytes32 studentRef, uint128 goal, uint64 deadline)
        external
        returns (uint256 requestId)
    {
        if (!registry.isVerified(msg.sender)) revert SchoolNotVerified(msg.sender);
        if (goal == 0) revert ZeroGoal();

        uint256 earliest = block.timestamp + MIN_DURATION;
        uint256 latest = block.timestamp + MAX_DURATION;
        if (deadline < earliest) revert DeadlineTooSoon(deadline, earliest);
        if (deadline > latest) revert DeadlineTooFar(deadline, latest);

        requestId = _requests.length;
        _requests.push(
            FundingRequest({
                school: msg.sender,
                studentRef: studentRef,
                goal: goal,
                raised: 0,
                createdAt: uint64(block.timestamp),
                deadline: deadline,
                disbursed: false
            })
        );
        _requestsBySchool[msg.sender].push(requestId);

        emit RequestCreated(requestId, msg.sender, studentRef, goal, deadline);
    }

    /// @notice Attach or replace the optional public context for a request.
    /// @dev Written by the school on the student's behalf so that a student is never required
    ///      to hold a wallet, pay gas, or expose an address in order to be helped. Editable
    ///      only while the request is still open, and never able to affect where money goes.
    function setContext(uint256 requestId, string calldata pseudonym, string calldata statement)
        external
    {
        FundingRequest storage request = _requestAt(requestId);
        if (request.school != msg.sender) revert NotSchool();
        if (request.disbursed) revert RequestClosed(requestId);

        _context[requestId] = StudentContext({pseudonym: pseudonym, statement: statement});

        emit ContextUpdated(requestId, pseudonym, statement);
    }

    // ---------------------------------------------------------------------
    // Contributor flow
    // ---------------------------------------------------------------------

    /// @notice Contribute toward a request.
    /// @dev Contributions above the outstanding remainder revert rather than being silently
    ///      trimmed, so a donor is never charged an amount they did not choose.
    function contribute(uint256 requestId, uint256 amount) external nonReentrant {
        FundingRequest storage request = _requestAt(requestId);

        if (request.disbursed) revert RequestClosed(requestId);
        // Validators can nudge `block.timestamp` by seconds. Deadlines here are day-scale by
        // construction (MIN_DURATION is 1 day), so that drift cannot change an outcome.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= request.deadline) revert DeadlinePassed(requestId);
        if (amount == 0) revert ZeroContribution();

        address school = request.school;
        if (!registry.isVerified(school)) revert SchoolNotVerified(school);

        uint256 remaining = request.goal - request.raised;
        if (amount > remaining) revert ExceedsRemaining(remaining);

        if (_contributions[requestId][msg.sender] == 0) {
            _contributors[requestId].push(msg.sender);
            _requestsByContributor[msg.sender].push(requestId);
        }
        _contributions[requestId][msg.sender] += amount;

        // casting to 'uint128' is safe because `amount <= remaining = goal - raised`, and
        // `goal` is itself a uint128, so `raised + amount` cannot exceed uint128 range.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 raised = request.raised + uint128(amount);
        request.raised = raised;

        emit ContributionReceived(requestId, msg.sender, amount, raised);
        if (raised == request.goal) {
            emit GoalReached(requestId, raised, uint64(block.timestamp));
        }

        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Send a fully-funded balance to the school. Callable by anyone.
    /// @dev Deliberately separate from `contribute` rather than triggered automatically by the
    ///      contribution that completes the goal: that would charge one donor for everyone
    ///      else's disbursement and would let a misbehaving recipient break contributions for
    ///      everybody. Verification is re-checked here, at the moment the money actually moves.
    function release(uint256 requestId) external nonReentrant {
        FundingRequest storage request = _requestAt(requestId);

        if (request.disbursed) revert AlreadyDisbursed(requestId);

        uint256 goal = request.goal;
        uint256 raised = request.raised;
        if (raised < goal) revert GoalNotReached(raised, goal);

        address school = request.school;
        if (!registry.isVerified(school)) revert SchoolNotVerified(school);

        request.disbursed = true;

        emit FundsDisbursed(requestId, school, goal);

        token.safeTransfer(school, goal);
    }

    /// @notice Reclaim your own contribution.
    /// @dev Available when the deadline passed without the goal being met, or at any time once
    ///      the school's verification has been revoked. Each contributor withdraws only what
    ///      they put in; there is no pooled refund and no administrative action required.
    function refund(uint256 requestId) external nonReentrant {
        FundingRequest storage request = _requestAt(requestId);

        if (request.disbursed) revert AlreadyDisbursed(requestId);
        if (!_refundable(request)) revert NotRefundable(requestId);

        uint256 amount = _contributions[requestId][msg.sender];
        if (amount == 0) revert NothingToRefund();

        _contributions[requestId][msg.sender] = 0;
        // casting to 'uint128' is safe because a contributor's recorded total is only ever
        // increased by `contribute`, which bounds the running sum at `goal` (a uint128).
        // forge-lint: disable-next-line(unsafe-typecast)
        request.raised -= uint128(amount);

        emit RefundClaimed(requestId, msg.sender, amount);

        token.safeTransfer(msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function requestCount() external view returns (uint256) {
        return _requests.length;
    }

    function getRequest(uint256 requestId) external view returns (FundingRequest memory) {
        return _requestAt(requestId);
    }

    function getContext(uint256 requestId) external view returns (StudentContext memory) {
        return _context[requestId];
    }

    /// @notice Everything the contribution screen needs, in one call.
    /// @dev `disbursementDestination` is returned explicitly so the interface can show a donor
    ///      exactly where their money goes before they sign, rather than burying it in terms.
    function requestSummary(uint256 requestId)
        external
        view
        returns (
            FundingRequest memory request,
            StudentContext memory context,
            address disbursementDestination,
            bool schoolVerified,
            string memory schoolName,
            string memory schoolProofURI,
            uint256 remaining,
            bool refundable
        )
    {
        request = _requestAt(requestId);
        context = _context[requestId];
        disbursementDestination = request.school;

        IVerifiedEntityRegistry.Entity memory entity = registry.entityOf(request.school);
        schoolVerified = entity.active;
        schoolName = entity.name;
        schoolProofURI = entity.proofURI;

        remaining = request.goal - request.raised;
        refundable = !request.disbursed && _refundable(request);
    }

    function contributionOf(uint256 requestId, address contributor) external view returns (uint256) {
        return _contributions[requestId][contributor];
    }

    function contributorCount(uint256 requestId) external view returns (uint256) {
        return _contributors[requestId].length;
    }

    function contributorsOf(uint256 requestId, uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory page)
    {
        return _paginate(_contributors[requestId], offset, limit);
    }

    function requestsBySchool(address school) external view returns (uint256[] memory) {
        return _requestsBySchool[school];
    }

    function requestsByContributor(address contributor) external view returns (uint256[] memory) {
        return _requestsByContributor[contributor];
    }

    /// @notice Paginated listing of all requests, newest-agnostic (ascending by id).
    function listRequests(uint256 offset, uint256 limit)
        external
        view
        returns (FundingRequest[] memory page)
    {
        uint256 total = _requests.length;
        if (offset >= total) return new FundingRequest[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new FundingRequest[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _requests[i];
        }
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _requestAt(uint256 requestId) private view returns (FundingRequest storage) {
        if (requestId >= _requests.length) revert UnknownRequest(requestId);
        return _requests[requestId];
    }

    function _refundable(FundingRequest memory request) private view returns (bool) {
        if (!registry.isVerified(request.school)) return true;
        // forge-lint: disable-next-line(block-timestamp)
        return block.timestamp >= request.deadline && request.raised < request.goal;
    }

    function _paginate(address[] storage source, uint256 offset, uint256 limit)
        private
        view
        returns (address[] memory page)
    {
        uint256 total = source.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = source[i];
        }
    }
}
