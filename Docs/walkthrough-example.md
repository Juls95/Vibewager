# VibeWager Market — Step-by-Step On-Chain Example

This document walks through a real example on BNB Testnet using three BscScan links: the deployed contract, a market-creation transaction, and a bet (liquidity/swap) transaction. You can follow along by opening each link and comparing with the steps below.

---

## Reference Links

| Step | Description | BscScan Link |
|------|-------------|--------------|
| **1. Contract** | VibeWagerMarket deployed on BNB Testnet | [Contract address](https://testnet.bscscan.com/address/0x4760e21a40f8f3b2bc7965124b57736c97bccac5) |
| **2. Market created** | Transaction that created a new prediction market | [Market creation tx](https://testnet.bscscan.com/tx/0x10433bcef36b9b75cc0611149dfe92cbe785e068421317e6798aa7557eedb22a) |
| **3. Bet placed** | Transaction that added liquidity / placed a bet | [Bet / liquidity tx](https://testnet.bscscan.com/tx/0xd9e888085c479ebd1f1f467c43ebfea6e815c33dc55e117c4fbecca56694f584) |

---

## Step 1: The Deployed Contract

**Link:** [https://testnet.bscscan.com/address/0x4760e21a40f8f3b2bc7965124b57736c97bccac5](https://testnet.bscscan.com/address/0x4760e21a40f8f3b2bc7965124b57736c97bccac5)

**What to do:**

1. Open the link. You are on the **Contract** tab for the VibeWagerMarket instance.
2. Confirm **Network:** BNB Smart Chain Testnet.
3. Note the **contract address:** `0x4760e21a40F8F3B2bC7965124B57736C97bcCAC5` (this is what the app uses in `VITE_CONTRACT_ADDRESS`).
4. In the **Contract** tab you can:
   - **Read contract:** e.g. `marketCount`, `owner`, `router`, and `getMarket(marketId)` to see each market’s Yes/No tokens and resolution status.
   - **Write contract:** only the `owner` can call `createMarket` and `resolveMarket`; any address can call `addLiquidityBNB` (with BNB sent).
5. Open the **Events** tab to see `MarketCreated`, `LiquidityAdded`, and `MarketResolved` logs.
6. Open the **Transactions** tab to see every tx that called this contract (including the two txs in the next steps).

**Why it matters:** This address is the single entry point for all markets in this deployment. The frontend and `interact.js` must use this address to list markets and to add liquidity through the contract.

---

## Step 2: Market Creation Transaction

**Link:** [https://testnet.bscscan.com/tx/0x10433bcef36b9b75cc0611149dfe92cbe785e068421317e6798aa7557eedb22a](https://testnet.bscscan.com/tx/0x10433bcef36b9b75cc0611149dfe92cbe785e068421317e6798aa7557eedb22a)

**What to do:**

1. Open the link. You are on the **Transaction** details page.
2. Confirm:
   - **Status:** Success (green).
   - **To:** The VibeWagerMarket contract (`0x4760e21a40F8F3B2bC7965124B57736C97bcCAC5`).
   - **From:** The owner wallet (this is the only address that can create markets).
3. Click **“Click to see More”** or scroll to **Input Data**. The decoded function should be **createMarket(string _question, uint64 _endTime)**. You may see the question text (e.g. “Will Team X win?”) and `_endTime` (often 0).
4. In the **Logs** section, find the **MarketCreated** event. It contains:
   - `marketId`
   - `creator` (same as “From”)
   - `yesToken` (address of the Yes outcome token)
   - `noToken` (address of the No outcome token)
   - `endTime`
5. (Optional) Click the **yesToken** or **noToken** address to open the BEP-20 token contract on BscScan. Those are the tokens that will be paired with WBNB when liquidity is added.

**Why it matters:** This tx is the on-chain proof that a new binary market was created. The event gives the exact Yes/No token addresses the frontend and router use for swaps and liquidity.

---

## Step 3: Bet / Liquidity Transaction

**Link:** [https://testnet.bscscan.com/tx/0xd9e888085c479ebd1f1f467c43ebfea6e815c33dc55e117c4fbecca56694f584](https://testnet.bscscan.com/tx/0xd9e888085c479ebd1f1f467c43ebfea6e815c33dc55e117c4fbecca56694f584)

**What to do:**

1. Open the link. You are on the **Transaction** details page.
2. Confirm:
   - **Status:** Success.
   - **To:** Again the VibeWagerMarket contract (liquidity is added through the market contract, which then calls PancakeRouter).
   - **From:** The liquidity provider / better (can be the owner or any user).
   - **Value:** Some amount of BNB (e.g. 0.01 BNB or similar) — this is the BNB used to create or increase the Yes/WBNB or No/WBNB pool.
3. In **Input Data**, the decoded function should be **addLiquidityBNB(...)** with parameters such as:
   - `marketId`
   - `yesSide` (true = Yes token pool, false = No token pool)
   - `tokenAmountDesired`, `tokenAmountMin`, `bnbAmountMin`, `deadline`
4. In **Logs**, find:
   - **LiquidityAdded** from VibeWagerMarket: `marketId`, provider, `yesSide`, `tokenAmount`, `bnbAmount`.
   - Possibly **Transfer** and **Sync** events from the pair contract (PancakeSwap) as liquidity is added.
5. (Optional) In the **Internal Txns** or **Token Transfers** section you can see BNB and token movements between the user, VibeWagerMarket, and the router/pair.

**Why it matters:** This tx shows a real “bet” or LP action: someone sent BNB and called `addLiquidityBNB`, which minted outcome tokens and added them with BNB to a PancakeSwap pair. After this, anyone can swap BNB for Yes or No tokens (or the opposite) via the router; the pool prices represent implied probabilities.

---

## Order of Operations (Summary)

1. **Contract deployed** → [Contract address](https://testnet.bscscan.com/address/0x4760e21a40f8f3b2bc7965124b57736c97bccac5): one VibeWagerMarket instance exists.
2. **Market created** → [Market creation tx](https://testnet.bscscan.com/tx/0x10433bcef36b9b75cc0611149dfe92cbe785e068421317e6798aa7557eedb22a): one new market (Yes/No tokens) is registered.
3. **Liquidity / bet** → [Bet tx](https://testnet.bscscan.com/tx/0xd9e888085c479ebd1f1f467c43ebfea6e815c33dc55e117c4fbecca56694f584): liquidity is added so the market becomes tradable; users can then swap BNB for outcome tokens (and vice versa).

Later, the owner would call **resolveMarket(marketId, outcome)** in a separate tx to set the winning outcome; that tx would appear in the same contract’s transaction list and emit **MarketResolved**.

---

## How to Reproduce This Flow

1. **Deploy (if needed):** From repo root, set `PRIVATE_KEY` in `.env` and run `pnpm deploy:testnet`. Use the printed contract address in the next steps.
2. **Create a market:**  
   `ACTION=create-market QUESTION="Will Team X win?" END_TIME=0 pnpm run interact`  
   (Optionally set `CONTRACT_ADDRESS` in `.env` to the address above.)  
   Copy the tx hash and open it on BscScan — you should see the same pattern as the “Market created” link.
3. **Add liquidity:**  
   `ACTION=add-liquidity MARKET_ID=1 YES_SIDE=true BNB_AMOUNT=0.01 pnpm run interact`  
   Copy the tx hash and open it on BscScan — you should see the same pattern as the “Bet placed” link.
4. **Use the app:** Set `VITE_CONTRACT_ADDRESS` in `app/.env` to the same contract address, run `cd app && npm run dev`, connect your wallet on BNB Testnet, and you should see the market and be able to place swaps (bets) via the UI.

This walkthrough ties the three BscScan links to the exact actions in the technical guide and shows how to verify and reproduce the flow on BNB Testnet.
