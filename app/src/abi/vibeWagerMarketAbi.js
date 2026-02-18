// Full JSON ABI (object form) for wagmi/viem compatibility.
// Human-readable string ABI can cause: Cannot use 'in' operator to search for 'name' in "function owner()..."
export const VIBEWAGER_ABI = [
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "marketCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_question", type: "string" },
      { internalType: "uint64", name: "_endTime", type: "uint64" },
    ],
    name: "createMarket",
    outputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    name: "getMarket",
    outputs: [
      {
        components: [
          { internalType: "address", name: "yesToken", type: "address" },
          { internalType: "address", name: "noToken", type: "address" },
          { internalType: "uint64", name: "endTime", type: "uint64" },
          { internalType: "bool", name: "resolved", type: "bool" },
          { internalType: "bool", name: "outcome", type: "bool" },
        ],
        internalType: "struct VibeWagerMarket.Market",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "bool", name: "yesSide", type: "bool" },
      { internalType: "uint256", name: "tokenAmountDesired", type: "uint256" },
      { internalType: "uint256", name: "tokenAmountMin", type: "uint256" },
      { internalType: "uint256", name: "bnbAmountMin", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "addLiquidityBNB",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];
