/** BNB Testnet */
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID) || 97;
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ||
  "https://data-seed-prebsc-1-s1.binance.org:8545";

export const VIBEWAGER_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x4760e21a40F8F3B2bC7965124B57736C97bcCAC5";

/** PancakeRouter V2 BNB Testnet */
export const PANCAKE_ROUTER =
  import.meta.env.VITE_PANCAKE_ROUTER ||
  "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";

/** PancakeSwap V2 Factory BNB Testnet (for pair/liquidity lookup) */
export const PANCAKE_FACTORY =
  import.meta.env.VITE_PANCAKE_FACTORY ||
  "0x6725F303b657a9451d8BA641348b6761A6CC7a17";

export const BSCSCAN_TESTNET = "https://testnet.bscscan.com";

/** WBNB on BNB Testnet */
export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

/** Zero address check (case-insensitive) */
export function isZeroAddress(addr) {
  if (addr == null || addr === "") return true;
  try {
    return BigInt(addr) === 0n;
  } catch {
    return true;
  }
}
