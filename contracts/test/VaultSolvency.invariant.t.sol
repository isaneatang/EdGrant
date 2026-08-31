// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VerifiedEntityRegistry} from "../src/VerifiedEntityRegistry.sol";
import {EducationFundingVault} from "../src/EducationFundingVault.sol";
import {IVerifiedEntityRegistry} from "../src/interfaces/IVerifiedEntityRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

/// @dev Drives the vault through random sequences of the operations a real user can perform.
contract VaultHandler is Test {
    EducationFundingVault public vault;
    VerifiedEntityRegistry public registry;
    MockUSDT public usdt;

    address public school;
    address[] public actors;
    uint256[] public requestIds;

    address internal verifierA;
    address internal verifierB;

    constructor(
        EducationFundingVault vault_,
        VerifiedEntityRegistry registry_,
        MockUSDT usdt_,
        address school_,
        address verifierA_,
        address verifierB_,
        address[] memory actors_
    ) {
        vault = vault_;
        registry = registry_;
        usdt = usdt_;
        school = school_;
        verifierA = verifierA_;
        verifierB = verifierB_;
        actors = actors_;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function createRequest(uint128 goal, uint64 duration) external {
        goal = uint128(bound(goal, 1e6, 1_000_000e6));
        duration = uint64(bound(duration, 1 days, 365 days));
        if (!registry.isVerified(school)) return;

        vm.prank(school);
        try vault.createRequest(keccak256(abi.encode(goal, duration, requestIds.length)), goal, uint64(block.timestamp) + duration)
        returns (uint256 id) {
            requestIds.push(id);
        } catch {}
    }

    function contribute(uint256 idSeed, uint256 actorSeed, uint256 amount) external {
        if (requestIds.length == 0) return;
        uint256 id = requestIds[idSeed % requestIds.length];
        address actor = _actor(actorSeed);

        EducationFundingVault.FundingRequest memory r = vault.getRequest(id);
        uint256 remaining = r.goal - r.raised;
        if (remaining == 0) return;
        amount = bound(amount, 1, remaining);

        vm.prank(actor);
        try vault.contribute(id, amount) {} catch {}
    }

    function release(uint256 idSeed) external {
        if (requestIds.length == 0) return;
        uint256 id = requestIds[idSeed % requestIds.length];
        try vault.release(id) {} catch {}
    }

    function refund(uint256 idSeed, uint256 actorSeed) external {
        if (requestIds.length == 0) return;
        uint256 id = requestIds[idSeed % requestIds.length];
        address actor = _actor(actorSeed);
        vm.prank(actor);
        try vault.refund(id) {} catch {}
    }

    function warp(uint256 delta) external {
        vm.warp(block.timestamp + bound(delta, 1 hours, 90 days));
    }

    /// @dev Verification churn is the adversarial case: it must never strand funds.
    function toggleVerification() external {
        if (registry.isVerified(school)) {
            vm.prank(verifierA);
            registry.revokeVerification(school, "invariant churn");
            vm.prank(verifierB);
            registry.revokeVerification(school, "invariant churn");
        } else {
            vm.deal(school, 0.5 ether);
            vm.prank(school);
            uint256 rid = registry.requestVerification{value: 0.5 ether}(
                "State University", IVerifiedEntityRegistry.EntityType.School, "https://example.edu/proof"
            );
            vm.prank(verifierA);
            registry.approveRequest(rid);
            vm.prank(verifierB);
            registry.approveRequest(rid);
        }
    }

    function requestCount() external view returns (uint256) {
        return requestIds.length;
    }

    function requestIdAt(uint256 i) external view returns (uint256) {
        return requestIds[i];
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }
}

contract VaultSolvencyInvariantTest is Test {
    VerifiedEntityRegistry internal registry;
    EducationFundingVault internal vault;
    MockUSDT internal usdt;
    VaultHandler internal handler;

    address internal school = makeAddr("school");
    address internal verifierA = makeAddr("verifierA");
    address internal verifierB = makeAddr("verifierB");

    function setUp() public {
        address[] memory verifiers = new address[](2);
        verifiers[0] = verifierA;
        verifiers[1] = verifierB;
        registry = new VerifiedEntityRegistry(verifiers, 2, 0.5 ether);

        usdt = new MockUSDT();
        vault = new EducationFundingVault(IVerifiedEntityRegistry(address(registry)), IERC20(address(usdt)));

        vm.warp(1_800_000_000);

        vm.deal(school, 0.5 ether);
        vm.prank(school);
        uint256 rid = registry.requestVerification{value: 0.5 ether}(
            "State University", IVerifiedEntityRegistry.EntityType.School, "https://example.edu/proof"
        );
        vm.prank(verifierA);
        registry.approveRequest(rid);
        vm.prank(verifierB);
        registry.approveRequest(rid);

        address[] memory actors = new address[](4);
        actors[0] = makeAddr("alice");
        actors[1] = makeAddr("bob");
        actors[2] = makeAddr("carol");
        actors[3] = makeAddr("dave");
        for (uint256 i = 0; i < actors.length; ++i) {
            usdt.mint(actors[i], 100_000_000e6);
            vm.prank(actors[i]);
            usdt.approve(address(vault), type(uint256).max);
        }

        handler = new VaultHandler(vault, registry, usdt, school, verifierA, verifierB, actors);
        targetContract(address(handler));
    }

    /// @notice The vault must always hold at least everything it still owes.
    ///         If this ever fails, some contributor cannot be made whole.
    function invariant_vaultIsSolvent() public view {
        uint256 owed;
        uint256 n = handler.requestCount();
        for (uint256 i = 0; i < n; ++i) {
            EducationFundingVault.FundingRequest memory r = vault.getRequest(handler.requestIdAt(i));
            if (!r.disbursed) owed += r.raised;
        }
        assertGe(usdt.balanceOf(address(vault)), owed, "vault owes more than it holds");
    }

    /// @notice Per-request accounting must reconcile: the sum of what individuals can claim
    ///         equals the total recorded as raised. No dust, no drift, no orphaned balance.
    function invariant_contributionsReconcile() public view {
        uint256 n = handler.requestCount();
        uint256 a = handler.actorCount();
        for (uint256 i = 0; i < n; ++i) {
            uint256 id = handler.requestIdAt(i);
            EducationFundingVault.FundingRequest memory r = vault.getRequest(id);
            if (r.disbursed) continue;

            uint256 sum;
            for (uint256 j = 0; j < a; ++j) {
                sum += vault.contributionOf(id, handler.actorAt(j));
            }
            assertEq(sum, r.raised, "per-contributor ledger disagrees with total raised");
        }
    }

    /// @notice Raised may never exceed the attested amount owed.
    function invariant_neverOverfunded() public view {
        uint256 n = handler.requestCount();
        for (uint256 i = 0; i < n; ++i) {
            EducationFundingVault.FundingRequest memory r = vault.getRequest(handler.requestIdAt(i));
            assertLe(r.raised, r.goal, "collected more than the school said was owed");
        }
    }
}
