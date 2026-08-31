// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VerifiedEntityRegistry} from "../src/VerifiedEntityRegistry.sol";
import {EducationFundingVault} from "../src/EducationFundingVault.sol";
import {IVerifiedEntityRegistry} from "../src/interfaces/IVerifiedEntityRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

abstract contract Base is Test {
    VerifiedEntityRegistry internal registry;
    EducationFundingVault internal vault;
    MockUSDT internal usdt;

    address internal verifierA = makeAddr("verifierA");
    address internal verifierB = makeAddr("verifierB");
    address internal verifierC = makeAddr("verifierC");

    address internal school = makeAddr("school");
    address internal otherSchool = makeAddr("otherSchool");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant FEE = 0.5 ether;
    uint256 internal constant USD = 1e6; // USDT has 6 decimals

    string internal constant PROOF = "https://example.edu/announcements/wallet-address";

    function setUp() public virtual {
        address[] memory initial = new address[](3);
        initial[0] = verifierA;
        initial[1] = verifierB;
        initial[2] = verifierC;

        registry = new VerifiedEntityRegistry(initial, 2, FEE);
        usdt = new MockUSDT();
        vault = new EducationFundingVault(IVerifiedEntityRegistry(address(registry)), IERC20(address(usdt)));

        vm.warp(1_800_000_000);
    }

    /// @dev Runs a school through the full application + 2-of-3 approval path.
    function _verify(address account, string memory name) internal returns (uint256 requestId) {
        vm.deal(account, FEE);
        vm.prank(account);
        requestId = registry.requestVerification{value: FEE}(
            name, IVerifiedEntityRegistry.EntityType.School, PROOF
        );
        vm.prank(verifierA);
        registry.approveRequest(requestId);
        vm.prank(verifierB);
        registry.approveRequest(requestId);
    }

    function _revoke(address account) internal {
        vm.prank(verifierA);
        registry.revokeVerification(account, "proof no longer resolves");
        vm.prank(verifierB);
        registry.revokeVerification(account, "proof no longer resolves");
    }

    function _fund(address who, uint256 amount) internal {
        usdt.mint(who, amount);
        vm.prank(who);
        usdt.approve(address(vault), type(uint256).max);
    }

    function _openRequest(uint256 goal, uint64 duration) internal returns (uint256 requestId) {
        vm.prank(school);
        // forge-lint: disable-next-line(unsafe-typecast)
        requestId = vault.createRequest(keccak256("student-2026-0417"), uint128(goal), uint64(block.timestamp) + duration);
    }
}
