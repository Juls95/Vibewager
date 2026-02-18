const hre = require("hardhat");

/**
 * Deployment script for VibeWagerMarket on BNB Testnet
 * 
 * PancakeRouter addresses:
 * - BNB Testnet: 0xD99D1c33F9fC3444f8101754aBC46c52416550D1 (PancakeRouter V2)
 * - BNB Mainnet: 0x10ED43C718714eb63d5aA57B78B54704E256024E
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log("Network:", network.name, "Chain ID:", network.chainId);

  // PancakeRouter address for BNB Testnet
  // Override via environment variable if needed: PANCAKE_ROUTER_ADDRESS
  const pancakeRouterAddress = 
    process.env.PANCAKE_ROUTER_ADDRESS || 
    "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // BNB Testnet PancakeRouter V2

  console.log("\nUsing PancakeRouter at:", pancakeRouterAddress);

  // Deploy VibeWagerMarket
  const VibeWagerMarket = await hre.ethers.getContractFactory("VibeWagerMarket");
  console.log("\nDeploying VibeWagerMarket...");
  
  const market = await VibeWagerMarket.deploy(pancakeRouterAddress);
  await market.waitForDeployment();

  const marketAddress = await market.getAddress();
  console.log("\n✅ VibeWagerMarket deployed to:", marketAddress);

  // Verify deployment
  const owner = await market.owner();
  const router = await market.router();
  const marketCount = await market.marketCount();

  console.log("\n📋 Deployment Details:");
  console.log("  Owner:", owner);
  console.log("  Router:", router);
  console.log("  Initial Market Count:", marketCount.toString());

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contract: "VibeWagerMarket",
    address: marketAddress,
    deployer: deployer.address,
    pancakeRouter: pancakeRouterAddress,
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };

  console.log("\n📄 Deployment Info (JSON):");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Instructions for next steps
  console.log("\n🚀 Next Steps:");
  console.log("  1. Create a market: market.createMarket('Will Team X win?', 0)");
  console.log("  2. Add liquidity: market.addLiquidityBNB(marketId, true, ...)");
  console.log("  3. Resolve market: market.resolveMarket(marketId, true)");
  console.log("\n💡 View on BscScan Testnet:");
  console.log(`     https://testnet.bscscan.com/address/${marketAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
