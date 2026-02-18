const { expect } = require("chai");
const hre = require("hardhat");

describe("VibeWagerMarket", function () {
  let market;
  let mockRouter;
  let owner;
  let user1;
  let user2;

  const QUESTION = "Will Team X win the DeFi track?";
  const END_TIME = 0n;
  const TOKEN_AMOUNT = hre.ethers.parseEther("1000");
  const BNB_AMOUNT = hre.ethers.parseEther("0.1");

  beforeEach(async function () {
    [owner, user1, user2] = await hre.ethers.getSigners();
    const MockRouter = await hre.ethers.getContractFactory("MockPancakeRouter");
    mockRouter = await MockRouter.deploy();
    await mockRouter.waitForDeployment();

    const VibeWagerMarket = await hre.ethers.getContractFactory("VibeWagerMarket");
    market = await VibeWagerMarket.deploy(await mockRouter.getAddress());
    await market.waitForDeployment();
  });

  describe("creation", function () {
    it("should create a market with Yes/No tokens and emit MarketCreated", async function () {
      await expect(market.createMarket(QUESTION, END_TIME))
        .to.emit(market, "MarketCreated");

      expect(await market.marketCount()).to.equal(1n);
      const m = await market.getMarket(1);
      expect(m.yesToken).to.properAddress;
      expect(m.noToken).to.properAddress;
      expect(m.endTime).to.equal(END_TIME);
      expect(m.resolved).to.equal(false);
    });

    it("should increment marketCount for multiple markets", async function () {
      await market.createMarket("Question A", 0n);
      await market.createMarket("Question B", 0n);
      expect(await market.marketCount()).to.equal(2n);

      const m1 = await market.getMarket(1);
      const m2 = await market.getMarket(2);
      expect(m1.yesToken).to.not.equal(m2.yesToken);
      expect(m1.noToken).to.not.equal(m2.noToken);
    });

    it("should revert createMarket if not owner", async function () {
      await expect(market.connect(user1).createMarket(QUESTION, END_TIME))
        .to.be.revertedWithCustomError(market, "NotOwner");
    });
  });

  describe("betting (addLiquidityBNB)", function () {
    beforeEach(async function () {
      await market.createMarket(QUESTION, END_TIME);
    });

    it("should add liquidity for Yes side and emit LiquidityAdded", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      await expect(
        market.connect(user1).addLiquidityBNB(
          1n,
          true,
          TOKEN_AMOUNT,
          TOKEN_AMOUNT / 2n,
          0n,
          deadline,
          { value: BNB_AMOUNT }
        )
      )
        .to.emit(market, "LiquidityAdded")
        .withArgs(1n, user1.address, true, TOKEN_AMOUNT, BNB_AMOUNT);
    });

    it("should add liquidity for No side", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      await expect(
        market.connect(user2).addLiquidityBNB(
          1n,
          false,
          TOKEN_AMOUNT,
          TOKEN_AMOUNT / 2n,
          0n,
          deadline,
          { value: BNB_AMOUNT }
        )
      )
        .to.emit(market, "LiquidityAdded")
        .withArgs(1n, user2.address, false, TOKEN_AMOUNT, BNB_AMOUNT);
    });

    it("should revert addLiquidityBNB for invalid market id", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      await expect(
        market.connect(user1).addLiquidityBNB(
          99n,
          true,
          TOKEN_AMOUNT,
          TOKEN_AMOUNT / 2n,
          0n,
          deadline,
          { value: BNB_AMOUNT }
        )
      ).to.be.revertedWithCustomError(market, "InvalidMarket");
    });
  });

  describe("resolution", function () {
    beforeEach(async function () {
      await market.createMarket(QUESTION, END_TIME);
    });

    it("should resolve market with outcome Yes and emit MarketResolved", async function () {
      await expect(market.resolveMarket(1n, true))
        .to.emit(market, "MarketResolved")
        .withArgs(1n, true);

      const m = await market.getMarket(1);
      expect(m.resolved).to.equal(true);
      expect(m.outcome).to.equal(true);
    });

    it("should resolve market with outcome No", async function () {
      await expect(market.resolveMarket(1n, false))
        .to.emit(market, "MarketResolved")
        .withArgs(1n, false);

      const m = await market.getMarket(1);
      expect(m.resolved).to.equal(true);
      expect(m.outcome).to.equal(false);
    });

    it("should revert resolveMarket if not owner", async function () {
      await expect(market.connect(user1).resolveMarket(1n, true))
        .to.be.revertedWithCustomError(market, "NotOwner");
    });

    it("should revert resolveMarket if already resolved", async function () {
      await market.resolveMarket(1n, true);
      await expect(market.resolveMarket(1n, false))
        .to.be.revertedWithCustomError(market, "MarketAlreadyResolved");
    });

    it("should revert resolveMarket for invalid market id", async function () {
      await expect(market.resolveMarket(99n, true))
        .to.be.revertedWithCustomError(market, "InvalidMarket");
    });
  });

  describe("full flow (create → add liquidity → resolve)", function () {
    it("should support create, add liquidity for Yes and No, then resolve", async function () {
      await market.createMarket(QUESTION, END_TIME);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      await market.connect(user1).addLiquidityBNB(
        1n,
        true,
        TOKEN_AMOUNT,
        TOKEN_AMOUNT / 2n,
        0n,
        deadline,
        { value: BNB_AMOUNT }
      );
      await market.connect(user2).addLiquidityBNB(
        1n,
        false,
        TOKEN_AMOUNT,
        TOKEN_AMOUNT / 2n,
        0n,
        deadline,
        { value: BNB_AMOUNT }
      );

      const before = await market.getMarket(1);
      expect(before.resolved).to.equal(false);

      await market.resolveMarket(1n, true);

      const after_ = await market.getMarket(1);
      expect(after_.resolved).to.equal(true);
      expect(after_.outcome).to.equal(true);
    });
  });

  describe("constructor", function () {
    it("should revert if router is zero address", async function () {
      const VibeWagerMarket = await hre.ethers.getContractFactory("VibeWagerMarket");
      await expect(
        VibeWagerMarket.deploy(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(VibeWagerMarket, "ZeroAddress");
    });
  });
});
