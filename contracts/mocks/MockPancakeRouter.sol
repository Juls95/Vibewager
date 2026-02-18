// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Mock router for tests: accepts addLiquidityETH and returns fixed amounts.
contract MockPancakeRouter {
    function addLiquidityETH(
        address,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address /* to */,
        uint256
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        amountToken = amountTokenDesired;
        amountETH = msg.value;
        liquidity = 1;
        // In real router, LP tokens would be minted to `to`. We skip that for tests.
    }
}
