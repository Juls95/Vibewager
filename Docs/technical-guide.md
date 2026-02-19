# VibeWager Market — Technical Guide

This document explains what the system does from start to finish, how components interact, and why each action matters. It is intended for developers and auditors.

---

## 1. Overview

- **Chain:** BNB Smart Chain Testnet (chain ID `97`).
- **Contracts:** One main contract (`VibeWagerMarket`), outcome tokens (`OutcomeToken`), and integration with PancakeSwap V2 (`PancakeRouter`).
- **Frontend:** React (Vite) app using Wagmi/Viem to read and write on BNB Testnet.
- **No custom token:** Only testnet BNB and WBNB; outcome tokens are created per market.

---

## 2. Lifecycle: Start to Finish

### Phase 1: Deployment

| Step | What happens | Who | Importance |
|------|----------------|-----|------------|
| 1.1 | Run `deploy.js` with `PRIVATE_KEY` and BNB Testnet RPC. | Developer | Produces the single `VibeWagerMarket` instance that will host all markets. |
| 1.2 | Constructor receives `PancakeRouter` address (BNB Testnet: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`). | Script | Contract can only add liquidity and interact with AMM through this router. |
| 1.3 | `owner` and `router` are set immutably; `marketCount = 0`. | Contract | Owner is the only address that can create markets and resolve them; router is fixed for the chain. |
| 1.4 | Script outputs contract address and BscScan link. | Script | Needed for frontend config (`VITE_CONTRACT_ADDRESS`) and for verification. |

**Important:** Store the deployed contract address in the repo (or env) and in `app/.env` as `VITE_CONTRACT_ADDRESS` so the frontend talks to the correct contract.

---

### Phase 2: Market Creation

| Step | What happens | Who | Importance |
|------|----------------|-----|------------|
| 2.1 | Owner calls `createMarket(question, endTime)`. | Owner only | Only the deployer can create markets; prevents spam and enforces a single “admin”. |
| 2.2 | Contract increments `marketCount` and assigns `marketId`. | Contract | Ensures a unique ID per market and a simple index for the frontend (`getMarket(1..n)`). |
| 2.3 | Two `OutcomeToken` contracts are deployed: one for “Yes”, one for “No”, with `minter = VibeWagerMarket`. | Contract | Yes/No tokens are the tradeable outcomes; only the market contract can mint (when adding liquidity). |
| 2.4 | `markets[marketId]` is set: `yesToken`, `noToken`, `endTime`, `resolved=false`, `outcome=false`. | Contract | This is the single source of truth for the market; frontend and scripts read it via `getMarket(marketId)`. |
| 2.5 | `MarketCreated(marketId, creator, yesToken, noToken, endTime)` is emitted. | Contract | Enables indexing and UI updates; BscScan shows this event on the market-creation tx. |

**Important:** Until liquidity is added (Phase 3), there are no PancakeSwap pairs yet; the market exists on-chain but is not yet bettable via the AMM.

---

### Phase 3: Adding Liquidity (Making the Market Bettable)

| Step | What happens | Who | Importance |
|------|----------------|-----|------------|
| 3.1 | Any address calls `addLiquidityBNB(marketId, yesSide, tokenAmountDesired, tokenAmountMin, bnbAmountMin, deadline)` and sends BNB (`msg.value`). | Anyone | Permissionless: anyone can be the first (or additional) liquidity provider; deepens the market. |
| 3.2 | Contract loads `Market` and selects `yesToken` or `noToken` from `yesSide`. | Contract | Determines which outcome side gets liquidity (Yes/WBNB or No/WBNB pool). |
| 3.3 | Contract mints `tokenAmountDesired` of the chosen token to itself, then approves the router for that amount. | Contract | Tokens must exist and be approved so PancakeRouter can pull them into the pair. |
| 3.4 | Contract calls `router.addLiquidityETH(token, tokenAmountDesired, tokenAmountMin, bnbAmountMin, msg.sender, deadline)` with `msg.value`. | Contract | PancakeSwap creates or tops up the pair (OutcomeToken/WBNB); LP tokens go to `msg.sender`. |
| 3.5 | Any leftover outcome tokens (e.g. from min constraints) are sent back to `msg.sender`. | Contract | Avoids locking dust in the contract. |
| 3.6 | `LiquidityAdded(marketId, provider, yesSide, tokenAmount, bnbAmount)` is emitted. | Contract | Tracks who added liquidity and how much; useful for analytics and UI. |

**Important:** After this, users can swap BNB for Yes or No tokens (and vice versa) via PancakeRouter. Pool prices imply probabilities (e.g. Yes at 0.6 BNB ≈ 60% implied). The frontend uses the router’s `getAmountsOut` and `swapExactETHForTokens` (or similar) for the “bet” UX.

---

### Phase 4: Betting (Swaps via Frontend)

| Step | What happens | Who | Importance |
|------|----------------|-----|------------|
| 4.1 | User connects wallet (MetaMask / WalletConnect) and switches to BNB Testnet. | User | All txs must be on chain 97 so they hit the deployed contract and PancakeSwap testnet. |
| 4.2 | Frontend reads `marketCount` and `getMarket(1..n)` from `VibeWagerMarket`. | Frontend | Renders the list of markets and their Yes/No token addresses. |
| 4.3 | User selects a market and chooses “Yes” or “No” and amount. Frontend gets pair address from PancakeRouter’s factory (`getPair(token, WBNB)`). | Frontend | Needed to call the correct pair or router for the chosen outcome. |
| 4.4 | User approves and sends a tx: typically `swapExactETHForTokens` (or similar) on PancakeRouter with the chosen outcome token. | User | This is the “bet”: BNB is swapped for outcome tokens; if the outcome wins, tokens can later be redeemed (post-resolution). |
| 4.5 | Router moves user’s BNB into the pair and sends outcome tokens to the user. | PancakeSwap | All on-chain; no custom backend; state is in the pair and in the user’s wallet. |

**Important:** Betting is implemented as standard AMM swaps; the “importance” of each action is that it ties user belief (Yes vs No) to on-chain exposure and sets the stage for resolution and redemption.

---

### Phase 5: Resolution

| Step | What happens | Who | Importance |
|------|----------------|-----|------------|
| 5.1 | After the real-world event, owner calls `resolveMarket(marketId, outcome)` with `outcome = true` (Yes wins) or `false` (No wins). | Owner only | Centralized resolution for the MVP; can be replaced later by an oracle (e.g. Chainlink). |
| 5.2 | Contract checks market exists and is not already resolved; sets `resolved = true` and `outcome = outcome`. | Contract | Prevents double resolution and fixes the canonical result for that market. |
| 5.3 | `MarketResolved(marketId, outcome)` is emitted. | Contract | Indexers and UI can show “Resolved: Yes” or “Resolved: No” and enable redemption flows. |

**Important:** Resolution does not automatically move funds; it only records the result. Redemption (burning losing tokens, paying winners) would be a separate contract or UI flow that reads `getMarket(marketId).resolved` and `.outcome` and then interacts with tokens/pools accordingly. In the current MVP, the main on-chain guarantee is that the winning side is recorded.

---

## 3. How Components Interact

- **VibeWagerMarket ↔ OutcomeToken:** VibeWagerMarket deploys and is the only minter; it mints when adding liquidity and approves the router.
- **VibeWagerMarket ↔ PancakeRouter:** Contract calls `addLiquidityETH` only; it does not perform swaps. Swaps are done by users (or frontend) directly with the router.
- **Frontend ↔ VibeWagerMarket:** Read-only for listing markets (`marketCount`, `getMarket`). No frontend call to create or resolve in the default UI (those are script/owner actions).
- **Frontend ↔ PancakeRouter:** Reads pair addresses and amounts; writes swap txs. Contract address is used only to know which Yes/No tokens belong to which market.

---

## 4. Configuration and Environment

- **Root `.env` (Hardhat):** `PRIVATE_KEY`, `BNB_TESTNET_RPC_URL`, optional `PANCAKE_ROUTER_ADDRESS`, optional `BSCSCAN_API_KEY`, optional `CONTRACT_ADDRESS` for `interact.js`.
- **`app/.env`:** `VITE_CONTRACT_ADDRESS` (deployed VibeWagerMarket), `VITE_CHAIN_ID=97`, `VITE_RPC_URL`, `VITE_PANCAKE_ROUTER`, optional `VITE_WALLETCONNECT_PROJECT_ID`.
- **PancakeRouter (BNB Testnet):** `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`.
- **WBNB (BNB Testnet):** `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd`.

---

## 5. Security and Invariants

- **Owner-only:** `createMarket` and `resolveMarket`; no ownership transfer in the current contract.
- **No zero router:** Constructor reverts if `_router == address(0)`.
- **Minter:** Only VibeWagerMarket can mint outcome tokens; LPs cannot mint arbitrarily.
- **Single resolution:** `resolveMarket` reverts if the market is already resolved.
- **Valid market:** All market operations revert if `markets[marketId].yesToken == address(0)`.

This technical guide, together with the architecture diagrams and the walkthrough document, gives a complete picture of what runs from deployment to resolution and how each action fits in.
