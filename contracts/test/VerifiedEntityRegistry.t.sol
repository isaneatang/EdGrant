// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {VerifiedEntityRegistry} from "../src/VerifiedEntityRegistry.sol";
import {IVerifiedEntityRegistry} from "../src/interfaces/IVerifiedEntityRegistry.sol";

contract VerifiedEntityRegistryTest is Base {
    // -- the central claim: no individual can grant or revoke identity ------

    function test_singleVerifierCannotApprove() public {
        vm.deal(school, FEE);
        vm.prank(school);
        uint256 id = registry.requestVerification{value: FEE}(
            "State University", IVerifiedEntityRegistry.EntityType.School, PROOF
        );

        vm.prank(verifierA);
        registry.approveRequest(id);

        assertFalse(registry.isVerified(school), "one verifier must not be enough");
        (uint256 confirmations, uint256 required) = registry.approvalProgress(id);
        assertEq(confirmations, 1);
        assertEq(required, 2);
    }

    function test_thresholdVerifiersCanApprove() public {
        uint256 id = _verify(school, "State University");

        assertTrue(registry.isVerified(school));
        IVerifiedEntityRegistry.Entity memory e = registry.entityOf(school);
        assertEq(e.name, "State University");
        assertEq(e.proofURI, PROOF);
        assertEq(uint8(e.entityType), uint8(IVerifiedEntityRegistry.EntityType.School));
        assertEq(e.verifiedBy, verifierB, "records the verifier that carried it past threshold");
        assertTrue(e.active);
        assertEq(registry.getRequest(id).applicant, school);
    }

    function test_sameVerifierCannotConfirmTwice() public {
        vm.deal(school, FEE);
        vm.prank(school);
        uint256 id = registry.requestVerification{value: FEE}(
            "State University", IVerifiedEntityRegistry.EntityType.School, PROOF
        );

        vm.prank(verifierA);
        registry.approveRequest(id);
        vm.prank(verifierA);
        registry.approveRequest(id);

        assertFalse(registry.isVerified(school), "double-confirming must not reach threshold");
    }

    function test_nonVerifierCannotApprove() public {
        vm.deal(school, FEE);
        vm.prank(school);
        uint256 id = registry.requestVerification{value: FEE}(
            "State University", IVerifiedEntityRegistry.EntityType.School, PROOF
        );

        vm.prank(alice);
        vm.expectRevert(VerifiedEntityRegistry.NotVerifier.selector);
        registry.approveRequest(id);
    }

    function test_singleVerifierCannotRevoke() public {
        _verify(school, "State University");

        vm.prank(verifierA);
        registry.revokeVerification(school, "suspected compromise");

        assertTrue(registry.isVerified(school), "one verifier must not be able to revoke");
    }

    function test_revocationClearsBadgeAndEnumeration() public {
        _verify(school, "State University");
        assertEq(registry.verifiedCount(), 1);

        _revoke(school);

        assertFalse(registry.isVerified(school));
        assertEq(registry.verifiedCount(), 0);
        assertTrue(registry.entityOf(school).active == false);
        assertEq(registry.entityOf(school).name, "State University", "record is kept for audit");
    }

    function test_reapplyAfterRevocationSucceeds() public {
        _verify(school, "State University");
        _revoke(school);

        // The epoch bump must not let the old revoke hash block a fresh cycle.
        _verify(school, "State University");
        assertTrue(registry.isVerified(school));
    }

    // -- anti-spam fee -----------------------------------------------------

    function test_wrongFeeReverts() public {
        vm.deal(school, 1 ether);
        vm.prank(school);
        vm.expectRevert(abi.encodeWithSelector(VerifiedEntityRegistry.IncorrectFee.selector, FEE, 0.1 ether));
        registry.requestVerification{value: 0.1 ether}(
            "Fake U", IVerifiedEntityRegistry.EntityType.School, PROOF
        );
    }

    function test_applicantCanWithdrawBeforeAnyConfirmation() public {
        vm.deal(school, FEE);
        vm.prank(school);
        uint256 id = registry.requestVerification{value: FEE}(
            "State University", IVerifiedEntityRegistry.EntityType.School, PROOF
        );

        vm.prank(school);
        registry.withdrawRequest(id);

        assertEq(school.balance, FEE, "full refund while untouched");
    }

    function test_applicantCannotWithdrawOnceReviewBegan() public {
        vm.deal(school, FEE);
        vm.prank(school);
        uint256 id = registry.requestVerification{value: FEE}(
            "State University", IVerifiedEntityRegistry.EntityType.School, PROOF
        );
        vm.prank(verifierA);
        registry.approveRequest(id);

        vm.prank(school);
        vm.expectRevert(VerifiedEntityRegistry.RequestAlreadyConfirmed.selector);
        registry.withdrawRequest(id);
    }

    function test_rejectionConsumesFee() public {
        vm.deal(school, FEE);
        vm.prank(school);
        uint256 id = registry.requestVerification{value: FEE}(
            "Fake U", IVerifiedEntityRegistry.EntityType.School, PROOF
        );

        vm.prank(verifierA);
        registry.rejectRequest(id, "proof does not resolve to the claimed institution");
        vm.prank(verifierB);
        registry.rejectRequest(id, "proof does not resolve to the claimed institution");

        assertFalse(registry.isVerified(school));
        assertEq(registry.collectedFees(), FEE);
        assertEq(school.balance, 0);
    }

    function test_feesWithdrawableOnlyByThreshold() public {
        _verify(school, "State University");
        address treasury = makeAddr("treasury");

        vm.prank(verifierA);
        registry.withdrawFees(treasury);
        assertEq(treasury.balance, 0, "one verifier must not move funds");

        vm.prank(verifierB);
        registry.withdrawFees(treasury);
        assertEq(treasury.balance, FEE);
        assertEq(registry.collectedFees(), 0);
    }

    // -- self-governing verifier set ---------------------------------------

    function test_noOwnerExists() public {
        // There is no admin path: a non-verifier cannot touch governance at all.
        vm.prank(alice);
        vm.expectRevert(VerifiedEntityRegistry.NotVerifier.selector);
        registry.addVerifier(alice);
    }

    function test_addVerifierRequiresThreshold() public {
        address newVerifier = makeAddr("verifierD");

        vm.prank(verifierA);
        registry.addVerifier(newVerifier);
        assertFalse(registry.isVerifier(newVerifier));

        vm.prank(verifierB);
        registry.addVerifier(newVerifier);
        assertTrue(registry.isVerifier(newVerifier));
        assertEq(registry.verifierCount(), 4);
    }

    function test_removeVerifierCannotDeadlockThreshold() public {
        // 3 verifiers, threshold 2. Removing one while demanding threshold 3 is impossible.
        vm.prank(verifierA);
        vm.expectRevert(abi.encodeWithSelector(VerifiedEntityRegistry.InvalidThreshold.selector, 3, 2));
        registry.removeVerifier(verifierC, 3);
    }

    function test_removeVerifierLowersThresholdAtomically() public {
        vm.prank(verifierA);
        registry.removeVerifier(verifierC, 2);
        vm.prank(verifierB);
        registry.removeVerifier(verifierC, 2);

        assertFalse(registry.isVerifier(verifierC));
        assertEq(registry.verifierCount(), 2);
        assertEq(registry.threshold(), 2);
    }

    function test_constructorRejectsImpossibleThreshold() public {
        address[] memory one = new address[](1);
        one[0] = verifierA;
        vm.expectRevert(abi.encodeWithSelector(VerifiedEntityRegistry.InvalidThreshold.selector, 2, 1));
        new VerifiedEntityRegistry(one, 2, FEE);
    }

    // -- enumeration without event logs ------------------------------------

    function test_verifiedAccountsArePaginable() public {
        _verify(school, "State University");
        _verify(otherSchool, "City College");

        address[] memory page = registry.verifiedAccounts(0, 10);
        assertEq(page.length, 2);
        assertEq(registry.verifiedAccounts(1, 10).length, 1);
        assertEq(registry.verifiedAccounts(5, 10).length, 0, "offset past end returns empty");
    }
}
