export const VIBEWAGER_ABI = [
  "function marketCount() view returns (uint256)",
  "function getMarket(uint256 marketId) view returns (tuple(address yesToken, address noToken, uint64 endTime, bool resolved, bool outcome))",
  "function addLiquidityBNB(uint256 marketId, bool yesSide, uint256 tokenAmountDesired, uint256 tokenAmountMin, uint256 bnbAmountMin, uint256 deadline) payable",
];
