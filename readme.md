# VibeWager Market

**DeFi Prediction Market for Hackathon Betting on BNB Chain**

---

## Project Overview

VibeWager Market is a decentralized prediction market that lets users bet on hackathon outcomes using DeFi AMMs on BNB Testnet. It gamifies events to boost engagement—similar to how Polymarket drives interest in real-world events—while meeting hackathon requirements: AI-assisted build, onchain proofs, reproducible open-source code, and no custom token (users bet with testnet BNB).

- **Chain:** BNB Chain — EVM, ~3s blocks, low gas (~0.1 gwei), PancakeSwap for pools

---

## Use Case

Users bet on binary hackathon outcomes (e.g. *“Will Team X win the DeFi track in Good Vibes Only?”*) via AMMs. Builders get exposure as bets spread on X; spectators participate with testnet BNB. During a 48-hour hackathon, users create markets for teams; top-bet teams gain visibility; winners redeem payouts onchain.

**Applied example:** 10 teams, markets created, winners resolved — all on BNB Testnet with faucet BNB ([testnet.bnbchain.org/faucet-smart](https://testnet.bnbchain.org/faucet-smart)). No login required.

---

## Problem Solved

- **Visibility:** Hackathons are fragmented; participants build in silos and ideas get little buzz.
- **Motivation:** Discord polls and similar tools lack skin-in-the-game.
- **Trust:** Centralized platforms (e.g. Kalshi) require regulation and custodial trust.

**VibeWager** addresses this with permissionless, onchain prediction markets: AMMs tie exposure to real activity; probability dashboards act as risk/alert tools when odds shift (e.g. underdog surges).

---

## How It Works

| Step | Description |
|------|-------------|
| **1. Market creation** | Admin deploys a market for a hackathon event (binary Yes/No). Mints Yes/No BEP-20 tokens and creates AMM pools on PancakeSwap Testnet (Yes/WBNB, No/WBNB). |
| **2. Betting** | Users connect wallets (e.g. MetaMask on BNB Testnet), swap testnet BNB for Yes/No tokens via PancakeRouter. Pool prices = implied probabilities (e.g. Yes at 0.6 BNB → 60% chance). |
| **3. Liquidity** | Anyone adds BNB/token liquidity to earn trading fees and deepen the market. |
| **4. Resolution** | After the event, admin/oracle (e.g. Chainlink) calls `resolve`: losing tokens are burned; winners redeem full collateral (1 BNB per winning share). |
| **5. Frontend** | React app lists markets, supports trades and resolutions. All state and outcomes are onchain (verifiable on BscScan Testnet). |

---

## BNB Chain Usage

- **Chain / deployment:** Smart contracts on **BNB Testnet** (chain ID `97`).
- **Collateral & gas:** Testnet BNB, wrapped as WBNB, for pool liquidity, bets, and transaction fees.
- **AMM:** PancakeSwap factories and routers (native to BNB) for low-cost swaps.

---

## Technical Notes

- **Prediction markets:** Event-based betting via smart contracts; outcome tokens (Yes/No ERC-20/BEP-20) traded on AMMs; resolution redeems winners via oracles/admin.
- **Adaptation from Polymarket CTF:** Binary ERC-20 for gas efficiency vs ERC-1155; AMM over CLOB for a simpler MVP.

---

## Business & Risks

- **Opportunity:** Hackathons see high dropout rates; prediction markets can increase retention and visibility (e.g. Polymarket-style volume growth around events). Revenue from LP fees (e.g. 0.25% on Pancake); community-driven.
- **Risks:** Oracle tampering → mitigate with Chainlink; regulatory (gambling) → testnet-only, fun-focused for hackathon.

---

## Applied Use Cases

1. **Hackathon betting (core)** — Bet on teams; resolve on winners; full flow on BNB Testnet.
2. **Community hype** — Integrate with platforms like DoraHacks for real-time odds and “liquidation-like” shift alerts.
3. **DeFi education** — New users simulate strategies on testnet with no real funds at risk.

---

## Repo & Links

- **Repository:** e.g. `github.com/julsr95/vibewager`
- **Testnet faucet:** [BNB Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)
