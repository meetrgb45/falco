// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FalcoCore.sol";

contract Deploy is Script {
    // ── Celo Sepolia constants ──────────────────────────────────────────
    address constant USDC_SEPOLIA  = 0x01C5C0122039549AD1493B8220cABEdD739BC44E;
    address constant PYTH_SEPOLIA  = 0x2880aB155794e7179c9eE2e38200202908C17B43;

    // ── Celo Mainnet constants ──────────────────────────────────────────
    address constant USDC_MAINNET  = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;
    address constant PYTH_MAINNET  = 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C;

    uint16 constant FEE_BPS = 100; // 1%

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        // Pick addresses based on chain
        address usdcAddr;
        address pythAddr;
        if (block.chainid == 44787) {          // Celo Sepolia
            usdcAddr = USDC_SEPOLIA;
            pythAddr = PYTH_SEPOLIA;
        } else if (block.chainid == 42220) {   // Celo Mainnet
            usdcAddr = USDC_MAINNET;
            pythAddr = PYTH_MAINNET;
        } else {
            revert("Unsupported chain");
        }

        vm.startBroadcast(deployerKey);

        FalcoCore core = new FalcoCore(
            deployer,   // admin
            deployer,   // treasury (change to multisig for mainnet)
            usdcAddr,
            pythAddr,
            FEE_BPS
        );

        vm.stopBroadcast();

        console.log("FalcoCore deployed at:", address(core));
        console.log("Chain ID:", block.chainid);
        console.log("Admin/Treasury:", deployer);
        console.log("USDC:", usdcAddr);
        console.log("Pyth:", pythAddr);
    }
}
