// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {SchoolProfile} from "../src/SchoolProfile.sol";
import {EdGrantLens} from "../src/EdGrantLens.sol";
import {IVerifiedEntityRegistry} from "../src/interfaces/IVerifiedEntityRegistry.sol";

contract EdGrantLensTest is Base {
    SchoolProfile internal profiles;
    EdGrantLens internal lens;

    function setUp() public override {
        super.setUp();
        profiles = new SchoolProfile(IVerifiedEntityRegistry(address(registry)));
        lens = new EdGrantLens(registry, vault, profiles);
        _verify(school, "Riverside Community College");
        _fund(alice, 100_000 * USD);
        _fund(bob, 100_000 * USD);
    }

    function test_statsTrackTheFullLifecycle() public {
        // Three requests: one disbursed, one open and partly funded, one left to expire.
        uint256 paid = _openRequest(300 * USD, 30 days);
        uint256 open = _openRequest(450 * USD, 30 days);
        uint256 doomed = _openRequest(1000 * USD, 10 days);

        vm.startPrank(alice);
        vault.contribute(paid, 300 * USD);
        vault.contribute(open, 175 * USD);
        vault.contribute(doomed, 50 * USD);
        vm.stopPrank();

        vault.release(paid);

        EdGrantLens.SchoolStats memory s = lens.schoolStats(school);
        assertEq(s.totalRequests, 3);
        assertEq(s.disbursedRequests, 1);
        assertEq(s.totalDisbursed, 300 * USD, "money that actually reached the school");
        assertEq(s.openRequests, 2, "both still accepting before any deadline passes");
        assertEq(s.totalRequested, 1750 * USD);
        assertEq(s.totalHeld, 225 * USD, "still in the vault, not yet paid out");

        vm.warp(block.timestamp + 11 days);
        s = lens.schoolStats(school);
        assertEq(s.expiredRequests, 1);
        assertEq(s.openRequests, 1);
        assertEq(s.totalDisbursed, 300 * USD, "disbursed history is unaffected by expiry");
    }

    function test_releasableIsDistinctFromOpen() public {
        uint256 id = _openRequest(300 * USD, 30 days);
        vm.prank(alice);
        vault.contribute(id, 300 * USD);

        EdGrantLens.SchoolStats memory s = lens.schoolStats(school);
        assertEq(s.releasableRequests, 1, "fully funded, awaiting release()");
        assertEq(s.openRequests, 0, "must not be advertised as still needing money");
    }

    function test_openRequestsExcludeFundedExpiredAndDisbursed() public {
        uint256 funded = _openRequest(300 * USD, 30 days);
        uint256 stillOpen = _openRequest(450 * USD, 30 days);
        uint256 expiring = _openRequest(500 * USD, 5 days);

        vm.prank(alice);
        vault.contribute(funded, 300 * USD);
        vm.warp(block.timestamp + 6 days);

        EdGrantLens.RequestView[] memory page = lens.openRequestsOf(school);
        assertEq(page.length, 1);
        assertEq(page[0].requestId, stillOpen);
        assertEq(page[0].remaining, 450 * USD);
        assertFalse(page[0].refundable);

        // Silence unused-variable warnings while documenting intent.
        assertTrue(expiring != stillOpen);
    }

    function test_globalFeedHidesRequestsFromRevokedSchools() public {
        _openRequest(300 * USD, 30 days);
        assertEq(lens.openRequests(0, 50).length, 1);

        _revoke(school);
        assertEq(lens.openRequests(0, 50).length, 0, "a revoked school must not be advertised");
    }

    function test_schoolPageReturnsEverythingInOneCall() public {
        vm.startPrank(school);
        profiles.setProfile(
            "Riverside Community College",
            "ipfs://logo",
            "ipfs://banner",
            "A two-year public college.",
            "https://example.edu",
            "Riverside"
        );
        profiles.publishPost(SchoolProfile.PostKind.Admission, "September intake open", "Closes 30 June.");
        vm.stopPrank();

        uint256 id = _openRequest(450 * USD, 30 days);
        vm.prank(school);
        vault.setContext(id, "A.M.", "Final year.");
        vm.prank(alice);
        vault.contribute(id, 100 * USD);

        (
            EdGrantLens.SchoolOverview memory overview,
            EdGrantLens.RequestView[] memory open,
            SchoolProfile.Post[] memory posts
        ) = lens.schoolPage(school, 10);

        // Verified facts, from the registry.
        assertTrue(overview.verified);
        assertEq(overview.entityName, "Riverside Community College");
        assertEq(overview.proofURI, PROOF);

        // Self-asserted content, from the profile.
        assertEq(overview.profile.description, "A two-year public college.");

        assertEq(overview.stats.totalRequested, 450 * USD);
        assertEq(open.length, 1);
        assertEq(open[0].remaining, 350 * USD);
        assertEq(open[0].context.pseudonym, "A.M.");
        assertEq(posts.length, 1);
        assertEq(posts[0].title, "September intake open");
    }

    function test_directoryListsVerifiedSchoolsWithTrackRecords() public {
        _verify(otherSchool, "City College");

        uint256 id = _openRequest(300 * USD, 30 days);
        vm.prank(alice);
        vault.contribute(id, 300 * USD);
        vault.release(id);

        EdGrantLens.SchoolOverview[] memory page = lens.directory(0, 10);
        assertEq(page.length, 2);

        for (uint256 i = 0; i < page.length; ++i) {
            if (page[i].school == school) {
                assertEq(page[i].stats.totalDisbursed, 300 * USD);
            } else {
                assertEq(page[i].stats.totalRequests, 0);
            }
            assertTrue(page[i].verified);
        }
    }

    function test_directoryDropsRevokedSchools() public {
        _verify(otherSchool, "City College");
        assertEq(lens.directory(0, 10).length, 2);

        _revoke(otherSchool);
        EdGrantLens.SchoolOverview[] memory page = lens.directory(0, 10);
        assertEq(page.length, 1);
        assertEq(page[0].school, school);
    }

    function test_refundableFlagSurfacesRevocation() public {
        uint256 id = _openRequest(450 * USD, 30 days);
        vm.prank(alice);
        vault.contribute(id, 100 * USD);

        _revoke(school);

        EdGrantLens.RequestView[] memory page = lens.requestsOf(school, 0, 10);
        assertEq(page.length, 1);
        assertTrue(page[0].refundable, "contributors must be told they can withdraw now");
        assertFalse(page[0].releasable);
    }
}
