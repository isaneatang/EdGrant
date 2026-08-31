// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {VerifiedEntityRegistry} from "../src/VerifiedEntityRegistry.sol";
import {EducationFundingVault} from "../src/EducationFundingVault.sol";
import {IVerifiedEntityRegistry} from "../src/interfaces/IVerifiedEntityRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SchoolProfile} from "../src/SchoolProfile.sol";
import {EdGrantLens} from "../src/EdGrantLens.sol";
import {MockUSDT} from "../test/mocks/MockUSDT.sol";

/// @notice Stands up a complete, populated demo: a verified dummy school with several fee
///         requests and some contributions already in flight.
///
/// @dev Intended for local anvil and for BOT Chain testnet (968) ONLY.
///
///      Running this means acting as your own verifier and approving your own school. On a
///      testnet that is simply how you exercise the flow. You hold every key, and nothing here
///      represents a real institution. On mainnet it would be precisely the impersonation this
///      project exists to prevent, so the script refuses to run on chain 677.
///
///      Local:
///        anvil &
///        forge script script/SeedDemo.s.sol:SeedDemo --rpc-url http://localhost:8545 --broadcast
///
///      Testnet (contracts already deployed, addresses in env):
///        forge script script/SeedDemo.s.sol:SeedDemo --rpc-url bohr --broadcast
contract SeedDemo is Script {
    uint256 internal constant USD = 1e6;

    VerifiedEntityRegistry internal registry;
    EducationFundingVault internal vault;
    SchoolProfile internal profiles;
    EdGrantLens internal lens;
    IERC20 internal token;

    uint256 internal verifierAPk;
    uint256 internal verifierBPk;
    uint256 internal schoolPk;
    uint256 internal donorPk;

    function run() external {
        require(block.chainid != 677, "SeedDemo: refusing to seed fake institutions on mainnet");

        verifierAPk = vm.envUint("VERIFIER_A_PK");
        verifierBPk = vm.envUint("VERIFIER_B_PK");
        schoolPk = vm.envUint("SCHOOL_PK");
        donorPk = vm.envOr("DONOR_PK", uint256(0));

        address verifierA = vm.addr(verifierAPk);
        address verifierB = vm.addr(verifierBPk);
        address school = vm.addr(schoolPk);

        if (block.chainid == 31337) {
            _deployLocal(verifierA, verifierB);
        } else {
            registry = VerifiedEntityRegistry(vm.envAddress("REGISTRY_ADDRESS"));
            vault = EducationFundingVault(vm.envAddress("VAULT_ADDRESS"));
            profiles = SchoolProfile(vm.envAddress("PROFILE_ADDRESS"));
            lens = EdGrantLens(vm.envAddress("LENS_ADDRESS"));
            token = vault.token();
        }

        console2.log("chainId   ", block.chainid);
        console2.log("registry  ", address(registry));
        console2.log("vault     ", address(vault));
        console2.log("profiles  ", address(profiles));
        console2.log("lens      ", address(lens));
        console2.log("token     ", address(token));
        console2.log("school    ", school);

        _verifySchool(school);
        _publishProfile();
        uint256[] memory ids = _createRequests(school);
        if (donorPk != 0) _contribute(ids);

        _report(school, ids);
    }

    // ---------------------------------------------------------------------

    function _deployLocal(address verifierA, address verifierB) internal {
        address[] memory verifiers = new address[](2);
        verifiers[0] = verifierA;
        verifiers[1] = verifierB;

        vm.startBroadcast(verifierAPk);
        MockUSDT usdt = new MockUSDT();
        registry = new VerifiedEntityRegistry(verifiers, 2, 0.1 ether);
        vault = new EducationFundingVault(IVerifiedEntityRegistry(address(registry)), IERC20(address(usdt)));
        profiles = new SchoolProfile(IVerifiedEntityRegistry(address(registry)));
        lens = new EdGrantLens(registry, vault, profiles);
        if (donorPk != 0) usdt.mint(vm.addr(donorPk), 100_000 * USD);
        vm.stopBroadcast();

        token = IERC20(address(usdt));
    }

    function _verifySchool(address school) internal {
        if (registry.isVerified(school)) {
            console2.log("school already verified, skipping application");
            return;
        }

        uint256 fee = registry.verificationFee();

        vm.broadcast(schoolPk);
        uint256 requestId = registry.requestVerification{value: fee}(
            "Riverside Community College",
            IVerifiedEntityRegistry.EntityType.School,
            // On testnet this is a placeholder. In production it must resolve to a page the
            // institution itself controls, stating this exact address.
            "https://example.edu/announcements/edgrant-wallet"
        );

        vm.broadcast(verifierAPk);
        registry.approveRequest(requestId);

        vm.broadcast(verifierBPk);
        registry.approveRequest(requestId);

        require(registry.isVerified(school), "SeedDemo: verification did not take effect");
        console2.log("verified via request", requestId);
    }

    function _publishProfile() internal {
        vm.startBroadcast(schoolPk);
        profiles.setProfile(
            "Riverside Community College",
            "ipfs://placeholder-logo",
            "ipfs://placeholder-banner",
            "A two-year public college serving the river district since 1962. Everything in this "
            "profile is written by the school and is verified by nobody; only the badge and its "
            "proof link are evidence.",
            "https://example.edu",
            "Riverside"
        );
        profiles.publishPost(
            SchoolProfile.PostKind.Admission,
            "September 2026 intake now open",
            "Applications for the September intake close on 30 June. Fee schedules are published below."
        );
        profiles.publishPost(
            SchoolProfile.PostKind.FeeNotice,
            "Semester 2 fee balances published",
            "Outstanding balances are now listed as funding requests on this page."
        );
        vm.stopBroadcast();
        console2.log("published profile and 2 posts");
    }

    function _createRequests(address school) internal returns (uint256[] memory ids) {
        ids = new uint256[](3);

        uint64 t = uint64(block.timestamp);

        vm.startBroadcast(schoolPk);

        // forge-lint: disable-next-line(unsafe-typecast)
        ids[0] = vault.createRequest(keccak256("RCC-2026-0417"), uint128(450 * USD), t + 30 days);
        vault.setContext(ids[0], "A.M.", "Final year. One semester of fees outstanding.");

        // forge-lint: disable-next-line(unsafe-typecast)
        ids[1] = vault.createRequest(keccak256("RCC-2026-0512"), uint128(1200 * USD), t + 60 days);
        vault.setContext(ids[1], "J.T.", "Second year engineering. Family income interrupted.");

        // Left without context deliberately: the mechanism must work fully when a student
        // shares nothing at all.
        // forge-lint: disable-next-line(unsafe-typecast)
        ids[2] = vault.createRequest(keccak256("RCC-2026-0688"), uint128(300 * USD), t + 14 days);

        vm.stopBroadcast();

        console2.log("created requests", ids[0], ids[1], ids[2]);
    }

    function _contribute(uint256[] memory ids) internal {
        address donor = vm.addr(donorPk);
        uint256 balance = token.balanceOf(donor);
        if (balance == 0) {
            console2.log("donor has no token balance, skipping contributions");
            return;
        }

        // Partially fund the first, fully fund the third so `release` can be exercised.
        uint256 partialAmount = 175 * USD;
        uint256 fullAmount = 300 * USD;
        if (balance < partialAmount + fullAmount) {
            console2.log("donor balance too low to seed contributions:", balance);
            return;
        }

        vm.startBroadcast(donorPk);
        token.approve(address(vault), partialAmount + fullAmount);
        vault.contribute(ids[0], partialAmount);
        vault.contribute(ids[2], fullAmount);
        vm.stopBroadcast();

        console2.log("contributed to requests", ids[0], ids[2]);
    }

    function _report(address school, uint256[] memory ids) internal view {
        console2.log("--- seeded state ---");
        console2.log("school verified:", registry.isVerified(school));
        for (uint256 i = 0; i < ids.length; ++i) {
            EducationFundingVault.FundingRequest memory r = vault.getRequest(ids[i]);
            console2.log("request", ids[i]);
            console2.log("   goal  ", r.goal);
            console2.log("   raised", r.raised);
        }
        console2.log("request 2 is fully funded and ready for release()");
    }
}
