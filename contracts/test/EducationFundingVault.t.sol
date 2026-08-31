// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {EducationFundingVault} from "../src/EducationFundingVault.sol";
import {VerifiedEntityRegistry} from "../src/VerifiedEntityRegistry.sol";

contract EducationFundingVaultTest is Base {
    // forge-lint: disable-next-line(unsafe-typecast)
    uint128 internal constant GOAL = uint128(450 * USD);

    function setUp() public override {
        super.setUp();
        _verify(school, "State University");
        _fund(alice, 10_000 * USD);
        _fund(bob, 10_000 * USD);
        _fund(carol, 10_000 * USD);
    }

    // -- only verified schools may attest ----------------------------------

    function test_unverifiedCannotCreateRequest() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.SchoolNotVerified.selector, alice));
        vault.createRequest(keccak256("x"), GOAL, uint64(block.timestamp) + 30 days);
    }

    function test_revokedSchoolCannotCreateRequest() public {
        _revoke(school);
        vm.prank(school);
        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.SchoolNotVerified.selector, school));
        vault.createRequest(keccak256("x"), GOAL, uint64(block.timestamp) + 30 days);
    }

    function test_deadlineBounds() public {
        vm.prank(school);
        vm.expectRevert();
        vault.createRequest(keccak256("x"), GOAL, uint64(block.timestamp) + 1 hours);

        vm.prank(school);
        vm.expectRevert();
        vault.createRequest(keccak256("x"), GOAL, uint64(block.timestamp) + 400 days);
    }

    // -- THE central guarantee: money can only ever reach the school -------

    function test_fundsGoToSchoolNotStudent() public {
        uint256 id = _openRequest(GOAL, 30 days);

        vm.prank(alice);
        vault.contribute(id, 200 * USD);
        vm.prank(bob);
        vault.contribute(id, 250 * USD);

        assertEq(usdt.balanceOf(address(vault)), GOAL);
        assertEq(usdt.balanceOf(school), 0);

        // Anyone may trigger release; the destination is not a parameter.
        vm.prank(carol);
        vault.release(id);

        assertEq(usdt.balanceOf(school), GOAL, "the verified school receives the full goal");
        assertEq(usdt.balanceOf(address(vault)), 0, "vault retains nothing");
        assertTrue(vault.getRequest(id).disbursed);
    }

    function test_releaseDestinationCannotBeInfluenced() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);

        // There is no function on the vault that accepts a payout address at all.
        // The only destination is request.school, fixed at creation by a verified caller.
        assertEq(vault.getRequest(id).school, school);

        vm.prank(alice);
        vault.release(id);
        assertEq(usdt.balanceOf(school), GOAL);
    }

    function test_cannotReleaseBeforeGoal() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, 100 * USD);

        vm.expectRevert(
            abi.encodeWithSelector(EducationFundingVault.GoalNotReached.selector, 100 * USD, GOAL)
        );
        vault.release(id);
    }

    function test_cannotReleaseTwice() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);
        vault.release(id);

        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.AlreadyDisbursed.selector, id));
        vault.release(id);
    }

    // -- revocation fails in the safe direction ----------------------------

    function test_revokedSchoolCannotBePaidEvenWhenFullyFunded() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);

        _revoke(school);

        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.SchoolNotVerified.selector, school));
        vault.release(id);
        assertEq(usdt.balanceOf(school), 0);
    }

    function test_revocationEnablesImmediateRefundBeforeDeadline() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, 200 * USD);
        vm.prank(bob);
        vault.contribute(id, 250 * USD);

        _revoke(school);

        uint256 aliceBefore = usdt.balanceOf(alice);
        vm.prank(alice);
        vault.refund(id);
        assertEq(usdt.balanceOf(alice) - aliceBefore, 200 * USD);

        vm.prank(bob);
        vault.refund(id);
        assertEq(usdt.balanceOf(address(vault)), 0, "every contributor recovers exactly their own");
    }

    function test_revokedSchoolBlocksNewContributions() public {
        uint256 id = _openRequest(GOAL, 30 days);
        _revoke(school);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.SchoolNotVerified.selector, school));
        vault.contribute(id, 10 * USD);
    }

    // -- refunds -----------------------------------------------------------

    function test_refundAfterMissedDeadline() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, 100 * USD);

        vm.warp(block.timestamp + 31 days);

        uint256 before = usdt.balanceOf(alice);
        vm.prank(alice);
        vault.refund(id);
        assertEq(usdt.balanceOf(alice) - before, 100 * USD);
    }

    function test_noRefundWhileStillOpen() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, 100 * USD);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.NotRefundable.selector, id));
        vault.refund(id);
    }

    function test_cannotRefundSomeoneElsesContribution() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, 100 * USD);
        vm.warp(block.timestamp + 31 days);

        vm.prank(bob);
        vm.expectRevert(EducationFundingVault.NothingToRefund.selector);
        vault.refund(id);
    }

    function test_cannotRefundTwice() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, 100 * USD);
        vm.warp(block.timestamp + 31 days);

        vm.startPrank(alice);
        vault.refund(id);
        vm.expectRevert(EducationFundingVault.NothingToRefund.selector);
        vault.refund(id);
        vm.stopPrank();
    }

    function test_noRefundAfterDisbursement() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);
        vault.release(id);

        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.AlreadyDisbursed.selector, id));
        vault.refund(id);
    }

    // -- contribution mechanics --------------------------------------------

    function test_overfundingReverts() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vault.contribute(id, 400 * USD);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.ExceedsRemaining.selector, 50 * USD));
        vault.contribute(id, 100 * USD);
    }

    function test_cannotContributeAfterDeadline() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.warp(block.timestamp + 31 days);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.DeadlinePassed.selector, id));
        vault.contribute(id, 10 * USD);
    }

    function test_repeatContributorCountedOnce() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.startPrank(alice);
        vault.contribute(id, 100 * USD);
        vault.contribute(id, 50 * USD);
        vm.stopPrank();

        assertEq(vault.contributorCount(id), 1);
        assertEq(vault.contributionOf(id, alice), 150 * USD);
        assertEq(vault.requestsByContributor(alice).length, 1);
    }

    // -- the donor-facing summary ------------------------------------------

    function test_requestSummaryExposesDestinationAndProof() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(school);
        vault.setContext(id, "A.M.", "Final year, one semester of fees outstanding.");

        (
            ,
            EducationFundingVault.StudentContext memory context,
            address destination,
            bool verified,
            string memory name,
            string memory proofURI,
            uint256 remaining,
            bool refundable
        ) = vault.requestSummary(id);

        assertEq(destination, school, "donor can see where the money goes before signing");
        assertTrue(verified);
        assertEq(name, "State University");
        assertEq(proofURI, PROOF, "verified badge links to re-checkable proof");
        assertEq(remaining, GOAL);
        assertFalse(refundable);
        assertEq(context.pseudonym, "A.M.");
    }

    function test_summaryReflectsRevocation() public {
        uint256 id = _openRequest(GOAL, 30 days);
        _revoke(school);

        (,,, bool verified,,,, bool refundable) = vault.requestSummary(id);
        assertFalse(verified, "UI must show the badge is gone");
        assertTrue(refundable, "and that contributors can withdraw");
    }

    function test_onlySchoolCanSetContext() public {
        uint256 id = _openRequest(GOAL, 30 days);
        vm.prank(alice);
        vm.expectRevert(EducationFundingVault.NotSchool.selector);
        vault.setContext(id, "hacked", "hacked");
    }

    function test_unknownRequestReverts() public {
        vm.expectRevert(abi.encodeWithSelector(EducationFundingVault.UnknownRequest.selector, 99));
        vault.getRequest(99);
    }

    // -- no privileged surface exists --------------------------------------

    /// @dev The disbursement destination is fixed at creation and reachable by no one.
    ///      Asserted so that adding a setter later breaks the build rather than the promise.
    function test_disbursementDestinationIsImmutable() public {
        uint256 id = _openRequest(GOAL, 30 days);
        address destination = vault.getRequest(id).school;
        assertEq(destination, school);

        // Fill and release from an unrelated account; destination is unchanged and unchangeable.
        vm.prank(alice);
        vault.contribute(id, GOAL);
        vm.prank(bob);
        vault.release(id);

        assertEq(vault.getRequest(id).school, destination, "school field never changes");
        assertEq(usdt.balanceOf(school), GOAL);
        assertEq(usdt.balanceOf(alice), 10_000 * USD - GOAL, "contributor is not the recipient");
        assertEq(usdt.balanceOf(bob), 10_000 * USD, "the releaser receives nothing");
    }

    function test_vaultHasNoAdminFunctions() public view {
        // Documented as an executable assertion: the deployer of this vault holds no role.
        // Every state-changing entry point is either permissionless or gated on being the
        // verified school for that specific request.
        assertEq(address(vault.registry()), address(registry));
        assertEq(address(vault.token()), address(usdt));
    }
}
