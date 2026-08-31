// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {VerifiedEntityRegistry} from "../src/VerifiedEntityRegistry.sol";
import {EducationFundingVault} from "../src/EducationFundingVault.sol";
import {SchoolProfile} from "../src/SchoolProfile.sol";
import {EdGrantLens} from "../src/EdGrantLens.sol";
import {IVerifiedEntityRegistry} from "../src/interfaces/IVerifiedEntityRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys the registry, then the vault bound to it.
///
/// @dev Deliberately refuses to guess. There is no fallback to testnet addresses when mainnet
///      configuration is missing. BOT Chain's own docs warn about exactly that failure mode,
///      and a vault pointed at the wrong token or the wrong registry is unrecoverable because
///      both are immutable.
///
///   forge script script/Deploy.s.sol:Deploy --rpc-url bohr --broadcast --verify
contract Deploy is Script {
    /// @dev Bridged USDT, 6 decimals. Verified live on both networks.
    address internal constant USDT_BOHR_TESTNET = 0x75edC9335175Fc0552D51D48439F229c10420fe3;
    address internal constant USDT_BOT_MAINNET = 0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C;

    function run() external {
        address[] memory verifiers = vm.envAddress("VERIFIERS", ",");
        uint256 threshold = vm.envUint("VERIFIER_THRESHOLD");
        uint256 fee = vm.envUint("VERIFICATION_FEE_WEI");

        address token = _tokenFor(block.chainid);

        require(verifiers.length >= 2, "Deploy: refuse to ship a single-verifier registry");
        require(threshold >= 2, "Deploy: threshold must be at least 2");
        require(threshold <= verifiers.length, "Deploy: threshold exceeds verifier count");

        vm.startBroadcast();

        VerifiedEntityRegistry registry = new VerifiedEntityRegistry(verifiers, threshold, fee);
        EducationFundingVault vault = new EducationFundingVault(
            IVerifiedEntityRegistry(address(registry)), IERC20(token)
        );
        SchoolProfile profiles = new SchoolProfile(IVerifiedEntityRegistry(address(registry)));
        // Stateless read helper. Safe to redeploy later without migrating anything.
        EdGrantLens lens = new EdGrantLens(registry, vault, profiles);

        vm.stopBroadcast();

        console2.log("chainId                 ", block.chainid);
        console2.log("VerifiedEntityRegistry  ", address(registry));
        console2.log("EducationFundingVault   ", address(vault));
        console2.log("SchoolProfile           ", address(profiles));
        console2.log("EdGrantLens             ", address(lens));
        console2.log("token (USDT)            ", token);
        console2.log("verifiers               ", verifiers.length);
        console2.log("threshold               ", threshold);
        console2.log("verificationFee (wei)   ", fee);
    }

    function _tokenFor(uint256 chainId) internal view returns (address) {
        if (chainId == 968) return USDT_BOHR_TESTNET;
        if (chainId == 677) return USDT_BOT_MAINNET;

        // Local/anvil runs must pass an explicit token; never silently borrow a real address.
        return vm.envAddress("TOKEN_ADDRESS");
    }
}
