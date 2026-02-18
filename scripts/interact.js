/**
 * Interact with deployed VibeWagerMarket on BNB Testnet.
 *
 * Usage (set CONTRACT_ADDRESS and PRIVATE_KEY in .env):
 *   npx hardhat run scripts/interact.js --network bnbTestnet
 *
 * Actions via env:
 *   ACTION=list
 *   ACTION=create-market QUESTION="Will Team X win?" END_TIME=0
 *   ACTION=add-liquidity MARKET_ID=1 YES_SIDE=true TOKEN_AMOUNT=1000000000000000000 BNB_AMOUNT=0.1
 *   ACTION=resolve MARKET_ID=1 OUTCOME=true
 *
 * Default contract (BNB Testnet): 0x4760e21a40F8F3B2bC7965124B57736C97bcCAC5
 */

const hre = require("hardhat");

const DEPLOYED_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x4760e21a40F8F3B2bC7965124B57736C97bcCAC5";

function parseWei(s) {
  if (!s) return 0n;
  if (typeof s === "string" && s.includes(".")) return hre.ethers.parseEther(s);
  return BigInt(s);
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const action = (process.env.ACTION || "list").toLowerCase();

  const market = await hre.ethers.getContractAt("VibeWagerMarket", DEPLOYED_ADDRESS);

  console.log("Network: BNB Testnet");
  console.log("Contract:", DEPLOYED_ADDRESS);
  console.log("Signer:", signer.address);
  console.log("Action:", action);
  console.log("");

  if (action === "list") {
    const count = await market.marketCount();
    console.log("Market count:", count.toString());
    for (let i = 1; i <= Number(count); i++) {
      try {
        const m = await market.getMarket(i);
        console.log("\nMarket", i, ":");
        console.log("  Yes token:", m.yesToken);
        console.log("  No token:", m.noToken);
        console.log("  End time:", m.endTime.toString());
        console.log("  Resolved:", m.resolved);
        console.log("  Outcome (true=Yes):", m.outcome);
      } catch (e) {
        console.log("  (invalid or missing)");
      }
    }
    return;
  }

  if (action === "create-market") {
    const question = process.env.QUESTION || "Will Team X win the DeFi track?";
    const endTime = process.env.END_TIME || "0";
    const tx = await market.createMarket(question, endTime);
    console.log("Tx hash:", tx.hash);
    await tx.wait();
    const count = await market.marketCount();
    console.log("Created market ID:", count.toString());
    return;
  }

  if (action === "add-liquidity") {
    const marketId = process.env.MARKET_ID || "1";
    const yesSide = (process.env.YES_SIDE || "true").toLowerCase() === "true";
    const tokenAmount = process.env.TOKEN_AMOUNT || "1000000000000000000"; // 1e18
    const bnbAmount = process.env.BNB_AMOUNT || "0.01";
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 min

    const tokenAmountDesired = parseWei(tokenAmount);
    const valueWei = parseWei(bnbAmount);

    const tx = await market.addLiquidityBNB(
      marketId,
      yesSide,
      tokenAmountDesired,
      tokenAmountDesired / 2n,
      0n,
      deadline,
      { value: valueWei }
    );
    console.log("Tx hash:", tx.hash);
    await tx.wait();
    console.log("Liquidity added.");
    return;
  }

  if (action === "resolve") {
    const marketId = process.env.MARKET_ID || "1";
    const outcome = (process.env.OUTCOME || "true").toLowerCase() === "true";
    const tx = await market.resolveMarket(marketId, outcome);
    console.log("Tx hash:", tx.hash);
    await tx.wait();
    console.log("Market resolved. Outcome:", outcome ? "Yes" : "No");
    return;
  }

  console.log("Unknown ACTION. Use: list | create-market | add-liquidity | resolve");
  console.log("Examples:");
  console.log('  ACTION=create-market QUESTION="Will Team X win?" END_TIME=0');
  console.log("  ACTION=add-liquidity MARKET_ID=1 YES_SIDE=true BNB_AMOUNT=0.01");
  console.log("  ACTION=resolve MARKET_ID=1 OUTCOME=true");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
