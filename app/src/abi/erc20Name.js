// Minimal ABI to read BEP-20/ERC-20 name (used for outcome token "Yes: {question}")
export const ERC20_NAME_ABI = [
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];
