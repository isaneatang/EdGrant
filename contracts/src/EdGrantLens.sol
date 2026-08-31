// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IVerifiedEntityRegistry} from "./interfaces/IVerifiedEntityRegistry.sol";
import {VerifiedEntityRegistry} from "./VerifiedEntityRegistry.sol";
import {EducationFundingVault} from "./EducationFundingVault.sol";
import {SchoolProfile} from "./SchoolProfile.sol";

/// @title EdGrantLens
/// @notice Read-only aggregation for the interface. Holds no state, holds no value, and has no
///         privileged functions. It only composes view calls across the other three contracts.
///
/// @dev Exists for two reasons.
///
///      First, the public BOT Chain mainnet RPC restricts eth_getLogs, so the dApp cannot
///      reconstruct pages by scanning events. Everything a screen needs must be answerable by
///      eth_call, and answering it in one round trip rather than dozens matters.
///
///      Second, being stateless means this contract can be redeployed freely as the interface
///      evolves, without migrating anything or touching contracts that hold money or grant
///      identity. Presentation changes should never require a value migration.
///
///      Note on trust, repeated here because this is where the interface gets its data:
///      `entityName` and `proofURI` come from the registry and are the verified facts.
///      `profile` is whatever the school typed about itself and is verified by nobody.
contract EdGrantLens {
    struct SchoolStats {
        uint256 totalRequests;
        /// @notice Accepting contributions right now.
        uint256 openRequests;
        /// @notice Goal met and paid out to the school.
        uint256 disbursedRequests;
        /// @notice Fully funded, awaiting a release() call.
        uint256 releasableRequests;
        /// @notice Deadline passed unmet; contributors can withdraw.
        uint256 expiredRequests;
        /// @notice Sum of every goal ever attested by this school.
        uint256 totalRequested;
        /// @notice Currently held by the vault on this school's behalf, not yet paid out.
        uint256 totalHeld;
        /// @notice Total actually delivered to this school. The track record that matters.
        uint256 totalDisbursed;
    }

    struct SchoolOverview {
        address school;
        /// @dev VERIFIED: proved by the registry's proof-of-control process.
        bool verified;
        string entityName;
        string proofURI;
        IVerifiedEntityRegistry.EntityType entityType;
        uint64 verifiedAt;
        /// @dev SELF-ASSERTED: typed by the school, checked by nobody.
        SchoolProfile.Profile profile;
        SchoolStats stats;
    }

    struct RequestView {
        uint256 requestId;
        EducationFundingVault.FundingRequest request;
        EducationFundingVault.StudentContext context;
        uint256 remaining;
        bool releasable;
        bool refundable;
    }

    VerifiedEntityRegistry public immutable registry;
    EducationFundingVault public immutable vault;
    SchoolProfile public immutable profiles;

    constructor(VerifiedEntityRegistry registry_, EducationFundingVault vault_, SchoolProfile profiles_) {
        registry = registry_;
        vault = vault_;
        profiles = profiles_;
    }

    // ---------------------------------------------------------------------
    // School page
    // ---------------------------------------------------------------------

    /// @notice Everything a school's public profile page needs, in one call.
    function schoolPage(address school, uint256 postLimit)
        external
        view
        returns (SchoolOverview memory overview, RequestView[] memory open, SchoolProfile.Post[] memory posts)
    {
        overview = schoolOverview(school);
        open = openRequestsOf(school);
        (posts,) = profiles.recentPosts(school, 0, postLimit, false);
    }

    function schoolOverview(address school) public view returns (SchoolOverview memory overview) {
        IVerifiedEntityRegistry.Entity memory entity = registry.entityOf(school);

        overview.school = school;
        overview.verified = entity.active;
        overview.entityName = entity.name;
        overview.proofURI = entity.proofURI;
        overview.entityType = entity.entityType;
        overview.verifiedAt = entity.verifiedAt;
        overview.profile = profiles.profileOf(school);
        overview.stats = schoolStats(school);
    }

    /// @notice The school's funding track record, computed from vault state.
    /// @dev `totalDisbursed` is the number a donor should weigh most: it is money that actually
    ///      reached the institution, not money that was merely asked for.
    function schoolStats(address school) public view returns (SchoolStats memory stats) {
        uint256[] memory ids = vault.requestsBySchool(school);
        stats.totalRequests = ids.length;

        for (uint256 i = 0; i < ids.length; ++i) {
            EducationFundingVault.FundingRequest memory r = vault.getRequest(ids[i]);
            stats.totalRequested += r.goal;

            if (r.disbursed) {
                ++stats.disbursedRequests;
                stats.totalDisbursed += r.goal;
                continue;
            }

            stats.totalHeld += r.raised;

            if (r.raised >= r.goal) {
                ++stats.releasableRequests;
                // forge-lint: disable-next-line(block-timestamp)
            } else if (block.timestamp >= r.deadline) {
                ++stats.expiredRequests;
            } else {
                ++stats.openRequests;
            }
        }
    }

    /// @notice Requests still accepting contributions, newest first.
    function openRequestsOf(address school) public view returns (RequestView[] memory page) {
        uint256[] memory ids = vault.requestsBySchool(school);

        RequestView[] memory buffer = new RequestView[](ids.length);
        uint256 found;

        for (uint256 i = ids.length; i > 0; --i) {
            uint256 id = ids[i - 1];
            EducationFundingVault.FundingRequest memory r = vault.getRequest(id);
            if (r.disbursed) continue;
            if (r.raised >= r.goal) continue;
            // Lens is read-only display categorisation; second-level drift cannot affect value.
            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp >= r.deadline) continue;
            buffer[found] = _requestView(id, r);
            ++found;
        }

        page = new RequestView[](found);
        for (uint256 i = 0; i < found; ++i) {
            page[i] = buffer[i];
        }
    }

    function requestsOf(address school, uint256 offset, uint256 limit)
        external
        view
        returns (RequestView[] memory page)
    {
        uint256[] memory ids = vault.requestsBySchool(school);
        uint256 total = ids.length;
        if (offset >= total) return new RequestView[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;

        page = new RequestView[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _requestView(ids[i], vault.getRequest(ids[i]));
        }
    }

    // ---------------------------------------------------------------------
    // Directory
    // ---------------------------------------------------------------------

    /// @notice Paginated directory of verified institutions with their track records.
    function directory(uint256 offset, uint256 limit) external view returns (SchoolOverview[] memory page) {
        address[] memory accounts = registry.verifiedAccounts(offset, limit);

        page = new SchoolOverview[](accounts.length);
        for (uint256 i = 0; i < accounts.length; ++i) {
            page[i] = schoolOverview(accounts[i]);
        }
    }

    /// @notice Global feed of requests currently accepting contributions.
    function openRequests(uint256 offset, uint256 limit) external view returns (RequestView[] memory page) {
        uint256 total = vault.requestCount();
        if (offset >= total) return new RequestView[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;

        RequestView[] memory buffer = new RequestView[](end - offset);
        uint256 found;

        for (uint256 id = offset; id < end; ++id) {
            EducationFundingVault.FundingRequest memory r = vault.getRequest(id);
            if (r.disbursed) continue;
            if (r.raised >= r.goal) continue;
            // Lens is read-only display categorisation; second-level drift cannot affect value.
            // forge-lint: disable-next-line(block-timestamp)
            if (block.timestamp >= r.deadline) continue;
            if (!registry.isVerified(r.school)) continue;
            buffer[found] = _requestView(id, r);
            ++found;
        }

        page = new RequestView[](found);
        for (uint256 i = 0; i < found; ++i) {
            page[i] = buffer[i];
        }
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _requestView(uint256 id, EducationFundingVault.FundingRequest memory r)
        private
        view
        returns (RequestView memory view_)
    {
        view_.requestId = id;
        view_.request = r;
        view_.context = vault.getContext(id);
        view_.remaining = r.goal - r.raised;
        view_.releasable = !r.disbursed && r.raised >= r.goal && registry.isVerified(r.school);
        // forge-lint: disable-next-line(block-timestamp)
        bool deadlineMissedUnmet = block.timestamp >= r.deadline && r.raised < r.goal;
        view_.refundable = !r.disbursed && (!registry.isVerified(r.school) || deadlineMissedUnmet);
    }
}
