// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IVerifiedEntityRegistry} from "./interfaces/IVerifiedEntityRegistry.sol";

/// @title SchoolProfile
/// @notice Public profile pages for verified institutions: presentation, admissions notices,
///         and fee announcements. Stored entirely on-chain.
///
/// @dev THE IMPORTANT DISTINCTION THIS CONTRACT MUST NOT BLUR.
///
///      Everything written here is SELF-ASSERTED by the school. Nobody verifies that a
///      description is accurate, that an admissions notice is real, or that a logo belongs to
///      the institution. The only verified facts in this system live in VerifiedEntityRegistry:
///      that this address is controlled by the named institution, and the proofURI where anyone
///      can re-check that for themselves.
///
///      An interface that renders profile text with the same visual authority as the verified
///      badge would hand impersonators exactly the credibility this project exists to deny
///      them. Profile content is marketing. The badge is evidence. Show them differently.
///
///      Writing requires current verification, so a revoked school cannot keep publishing.
///      Reading never requires it — a revoked school's profile stays readable so that the
///      interface can show what was claimed alongside the fact that the badge is gone.
///
///      Deployed separately from the registry and the vault so that presentation concerns can
///      change freely without redeploying anything that holds value or grants identity.
contract SchoolProfile {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum PostKind {
        General,
        Admission,
        FeeNotice
    }

    struct Profile {
        string displayName;
        string logoURI;
        string bannerURI;
        string description;
        string website;
        string location;
        uint64 updatedAt;
        bool exists;
    }

    struct Post {
        string title;
        string body;
        PostKind kind;
        uint64 postedAt;
        /// @dev A school can hide a post from the interface. It cannot erase it: this is a
        ///      public chain and the content remains in history and in this contract's state.
        ///      Presented honestly rather than as a delete button that does not delete.
        bool visible;
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotVerified(address account);
    error ZeroAddress();
    error EmptyDisplayName();
    error EmptyTitle();
    error StringTooLong(uint256 length, uint256 max);
    error NoProfile(address school);
    error UnknownPost(address school, uint256 postId);

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ProfileUpdated(address indexed school, string displayName, uint64 updatedAt);
    event PostPublished(
        address indexed school, uint256 indexed postId, PostKind indexed kind, string title, uint64 postedAt
    );
    event PostVisibilityChanged(address indexed school, uint256 indexed postId, bool visible);

    // ---------------------------------------------------------------------
    // Limits
    // ---------------------------------------------------------------------

    /// @dev Bounds exist so that paginated view calls return predictably-sized data and a
    ///      single post cannot make a profile page unreadable. Generous, not restrictive.
    uint256 public constant MAX_SHORT = 128;
    uint256 public constant MAX_URI = 512;
    uint256 public constant MAX_DESCRIPTION = 4096;
    uint256 public constant MAX_TITLE = 256;
    uint256 public constant MAX_BODY = 8192;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    IVerifiedEntityRegistry public immutable registry;

    mapping(address school => Profile) private _profiles;
    mapping(address school => Post[]) private _posts;

    /// @dev Enumerable list of schools that have ever published a profile, so the directory
    ///      page can be built from view calls alone. The public mainnet RPC restricts
    ///      eth_getLogs, so on-chain enumeration is required rather than merely convenient.
    address[] private _profiled;

    constructor(IVerifiedEntityRegistry registry_) {
        if (address(registry_) == address(0)) revert ZeroAddress();
        registry = registry_;
    }

    modifier onlyVerified() {
        if (!registry.isVerified(msg.sender)) revert NotVerified(msg.sender);
        _;
    }

    // ---------------------------------------------------------------------
    // School writes
    // ---------------------------------------------------------------------

    function setProfile(
        string calldata displayName,
        string calldata logoURI,
        string calldata bannerURI,
        string calldata description,
        string calldata website,
        string calldata location
    ) external onlyVerified {
        if (bytes(displayName).length == 0) revert EmptyDisplayName();
        _checkLength(bytes(displayName).length, MAX_SHORT);
        _checkLength(bytes(logoURI).length, MAX_URI);
        _checkLength(bytes(bannerURI).length, MAX_URI);
        _checkLength(bytes(description).length, MAX_DESCRIPTION);
        _checkLength(bytes(website).length, MAX_URI);
        _checkLength(bytes(location).length, MAX_SHORT);

        Profile storage profile = _profiles[msg.sender];
        if (!profile.exists) {
            profile.exists = true;
            _profiled.push(msg.sender);
        }

        profile.displayName = displayName;
        profile.logoURI = logoURI;
        profile.bannerURI = bannerURI;
        profile.description = description;
        profile.website = website;
        profile.location = location;
        profile.updatedAt = uint64(block.timestamp);

        emit ProfileUpdated(msg.sender, displayName, uint64(block.timestamp));
    }

    /// @notice Publish an admissions notice, a fee announcement, or a general update.
    function publishPost(PostKind kind, string calldata title, string calldata body)
        external
        onlyVerified
        returns (uint256 postId)
    {
        if (bytes(title).length == 0) revert EmptyTitle();
        _checkLength(bytes(title).length, MAX_TITLE);
        _checkLength(bytes(body).length, MAX_BODY);

        postId = _posts[msg.sender].length;
        _posts[msg.sender].push(
            Post({title: title, body: body, kind: kind, postedAt: uint64(block.timestamp), visible: true})
        );

        emit PostPublished(msg.sender, postId, kind, title, uint64(block.timestamp));
    }

    function setPostVisibility(uint256 postId, bool visible) external onlyVerified {
        if (postId >= _posts[msg.sender].length) revert UnknownPost(msg.sender, postId);
        _posts[msg.sender][postId].visible = visible;
        emit PostVisibilityChanged(msg.sender, postId, visible);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function profileOf(address school) external view returns (Profile memory) {
        return _profiles[school];
    }

    function hasProfile(address school) external view returns (bool) {
        return _profiles[school].exists;
    }

    function postCount(address school) external view returns (uint256) {
        return _posts[school].length;
    }

    function getPost(address school, uint256 postId) external view returns (Post memory) {
        if (postId >= _posts[school].length) revert UnknownPost(school, postId);
        return _posts[school][postId];
    }

    /// @notice Posts newest-first, which is how a profile page reads them.
    /// @param includeHidden Pass true for the school's own management view.
    function recentPosts(address school, uint256 offset, uint256 limit, bool includeHidden)
        external
        view
        returns (Post[] memory page, uint256[] memory postIds)
    {
        Post[] storage all = _posts[school];
        uint256 total = all.length;

        // Walk backwards from newest, skipping `offset` matches, collecting up to `limit`.
        Post[] memory buffer = new Post[](limit);
        uint256[] memory ids = new uint256[](limit);
        uint256 skipped;
        uint256 found;

        for (uint256 i = total; i > 0 && found < limit; --i) {
            uint256 index = i - 1;
            if (!includeHidden && !all[index].visible) continue;
            if (skipped < offset) {
                ++skipped;
                continue;
            }
            buffer[found] = all[index];
            ids[found] = index;
            ++found;
        }

        page = new Post[](found);
        postIds = new uint256[](found);
        for (uint256 i = 0; i < found; ++i) {
            page[i] = buffer[i];
            postIds[i] = ids[i];
        }
    }

    function profiledCount() external view returns (uint256) {
        return _profiled.length;
    }

    function profiledSchools(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 total = _profiled.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _profiled[i];
        }
    }

    function _checkLength(uint256 length, uint256 max) private pure {
        if (length > max) revert StringTooLong(length, max);
    }
}
