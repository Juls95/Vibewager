// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice PancakeSwap / UniswapV2-compatible router interface subset for addLiquidityETH.
interface IPancakeRouterLike {
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        );
}
