// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {SchoolProfile} from "../src/SchoolProfile.sol";
import {EdGrantLens} from "../src/EdGrantLens.sol";
import {IVerifiedEntityRegistry} from "../src/interfaces/IVerifiedEntityRegistry.sol";

contract SchoolProfileTest is Base {
    SchoolProfile internal profiles;
    EdGrantLens internal lens;

    function setUp() public override {
        super.setUp();
        profiles = new SchoolProfile(IVerifiedEntityRegistry(address(registry)));
        lens = new EdGrantLens(registry, vault, profiles);
        _verify(school, "Riverside Community College");
        _fund(alice, 10_000 * USD);
        _fund(bob, 10_000 * USD);
    }

    function _setProfile(address who) internal {
        vm.prank(who);
        profiles.setProfile(
            "Riverside Community College",
            "ipfs://logo",
            "ipfs://banner",
            "A two-year public college serving the river district since 1962.",
            "https://example.edu",
            "Riverside"
        );
    }

    // -- only verified schools may publish ---------------------------------

    function test_unverifiedCannotSetProfile() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SchoolProfile.NotVerified.selector, alice));
        profiles.setProfile("Fake U", "", "", "", "", "");
    }

    function test_unverifiedCannotPost() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SchoolProfile.NotVerified.selector, alice));
        profiles.publishPost(SchoolProfile.PostKind.Admission, "Applications open", "body");
    }

    function test_revokedSchoolCannotPublishButProfileStaysReadable() public {
        _setProfile(school);
        _revoke(school);

        vm.prank(school);
        vm.expectRevert(abi.encodeWithSelector(SchoolProfile.NotVerified.selector, school));
        profiles.publishPost(SchoolProfile.PostKind.General, "still here", "body");

        // Readable so the interface can show what was claimed next to the missing badge.
        assertEq(profiles.profileOf(school).displayName, "Riverside Community College");
        assertFalse(lens.schoolOverview(school).verified);
    }

    // -- profile content ---------------------------------------------------

    function test_setAndUpdateProfile() public {
        _setProfile(school);

        SchoolProfile.Profile memory p = profiles.profileOf(school);
        assertEq(p.displayName, "Riverside Community College");
        assertEq(p.website, "https://example.edu");
        assertTrue(p.exists);
        assertEq(profiles.profiledCount(), 1);

        vm.prank(school);
        profiles.setProfile("Riverside CC", "ipfs://logo2", "", "Updated.", "https://example.edu", "Riverside");

        assertEq(profiles.profileOf(school).displayName, "Riverside CC");
        assertEq(profiles.profiledCount(), 1, "updating must not duplicate the directory entry");
    }

    function test_emptyDisplayNameRejected() public {
        vm.prank(school);
        vm.expectRevert(SchoolProfile.EmptyDisplayName.selector);
        profiles.setProfile("", "", "", "", "", "");
    }

    function test_oversizedFieldRejected() public {
        string memory tooLong = new string(5000);
        vm.prank(school);
        vm.expectRevert();
        profiles.setProfile("Name", "", "", tooLong, "", "");
    }

    // -- admissions and fee notices ----------------------------------------

    function test_publishPostsOfEachKind() public {
        vm.startPrank(school);
        uint256 a = profiles.publishPost(
            SchoolProfile.PostKind.Admission, "September intake now open", "Applications close 30 June."
        );
        uint256 b = profiles.publishPost(
            SchoolProfile.PostKind.FeeNotice, "Semester 2 fees published", "Balances are now visible."
        );
        uint256 c = profiles.publishPost(SchoolProfile.PostKind.General, "Campus notice", "Library hours extended.");
        vm.stopPrank();

        assertEq(profiles.postCount(school), 3);
        assertEq(uint8(profiles.getPost(school, a).kind), uint8(SchoolProfile.PostKind.Admission));
        assertEq(uint8(profiles.getPost(school, b).kind), uint8(SchoolProfile.PostKind.FeeNotice));
        assertEq(uint8(profiles.getPost(school, c).kind), uint8(SchoolProfile.PostKind.General));
    }

    function test_recentPostsAreNewestFirst() public {
        vm.startPrank(school);
        profiles.publishPost(SchoolProfile.PostKind.General, "first", "");
        profiles.publishPost(SchoolProfile.PostKind.General, "second", "");
        profiles.publishPost(SchoolProfile.PostKind.General, "third", "");
        vm.stopPrank();

        (SchoolProfile.Post[] memory page, uint256[] memory ids) = profiles.recentPosts(school, 0, 10, false);
        assertEq(page.length, 3);
        assertEq(page[0].title, "third");
        assertEq(page[2].title, "first");
        assertEq(ids[0], 2);
    }

    function test_recentPostsPaginate() public {
        vm.startPrank(school);
        for (uint256 i = 0; i < 5; ++i) {
            profiles.publishPost(SchoolProfile.PostKind.General, "post", "");
        }
        vm.stopPrank();

        (SchoolProfile.Post[] memory firstTwo,) = profiles.recentPosts(school, 0, 2, false);
        assertEq(firstTwo.length, 2);
        (SchoolProfile.Post[] memory page,) = profiles.recentPosts(school, 4, 10, false);
        assertEq(page.length, 1);
    }

    function test_hidingExcludesFromPublicFeedButNotHistory() public {
        vm.startPrank(school);
        uint256 id = profiles.publishPost(SchoolProfile.PostKind.General, "retracted", "");
        profiles.publishPost(SchoolProfile.PostKind.General, "current", "");
        profiles.setPostVisibility(id, false);
        vm.stopPrank();

        (SchoolProfile.Post[] memory publicFeed,) = profiles.recentPosts(school, 0, 10, false);
        assertEq(publicFeed.length, 1);
        assertEq(publicFeed[0].title, "current");

        (SchoolProfile.Post[] memory ownerFeed,) = profiles.recentPosts(school, 0, 10, true);
        assertEq(ownerFeed.length, 2, "hidden is not deleted; it remains on-chain");
        assertFalse(profiles.getPost(school, id).visible);
    }

    function test_onlyOwnSchoolCanHideItsPosts() public {
        vm.prank(school);
        profiles.publishPost(SchoolProfile.PostKind.General, "post", "");

        _verify(otherSchool, "City College");
        vm.prank(otherSchool);
        vm.expectRevert(abi.encodeWithSelector(SchoolProfile.UnknownPost.selector, otherSchool, 0));
        profiles.setPostVisibility(0, false);

        assertTrue(profiles.getPost(school, 0).visible, "another school cannot touch this post");
    }
}
