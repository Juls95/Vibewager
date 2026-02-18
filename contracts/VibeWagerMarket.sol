// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OutcomeToken.sol";
import "./IPancakeRouterLike.sol";

/// @title VibeWagerMarket
/// @notice Binary prediction markets with BEP-20 Yes/No tokens on BNB Chain and PancakeRouter liquidity hooks.
contract VibeWagerMarket {
    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error NotOwner();
    error InvalidMarket();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error ZeroAddress();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        address yesToken,
        address noToken,
        uint64 endTime
    );

    event MarketResolved(uint256 indexed marketId, bool outcome);

    event LiquidityAdded(
        uint256 indexed marketId,
        address indexed provider,
        bool yesSide,
        uint256 tokenAmount,
        uint256 bnbAmount
    );

    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------

    struct Market {
        // 20 + 20 bytes
        address yesToken;
        address noToken;
        // packed in remaining 12 bytes of this slot and the next one
        uint64 endTime; // optional, can be 0
        bool resolved;
        bool outcome; // true = Yes, false = No
    }

    address public immutable owner;
    IPancakeRouterLike public immutable router;

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor(address _router) {
        if (_router == address(0)) revert ZeroAddress();
        owner = msg.sender;
        router = IPancakeRouterLike(_router);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // -----------------------------------------------------------------------
    // Market management
    // -----------------------------------------------------------------------

    /// @notice Create a new binary prediction market and deploy Yes/No tokens.
    /// @param _question Short identifier used in token naming.
    /// @param _endTime Optional end time (0 if not used).
    /// @return marketId The id of the newly created market.
    function createMarket(string calldata _question, uint64 _endTime) external onlyOwner returns (uint256 marketId) {
        marketId = ++marketCount;

        // Deploy outcome tokens; using short names for lower gas on deployment.
        OutcomeToken yes = new OutcomeToken(
            string(abi.encodePacked("Yes: ", _question)),
            "YES",
            address(this)
        );
        OutcomeToken no = new OutcomeToken(
            string(abi.encodePacked("No: ", _question)),
            "NO",
            address(this)
        );

        markets[marketId] = Market({
            yesToken: address(yes),
            noToken: address(no),
            endTime: _endTime,
            resolved: false,
            outcome: false
        });

        emit MarketCreated(marketId, msg.sender, address(yes), address(no), _endTime);
    }

    /// @notice Resolve a market and set the winning outcome.
    /// @param marketId Id of the market.
    /// @param outcome True for Yes, false for No.
    function resolveMarket(uint256 marketId, bool outcome) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.yesToken == address(0)) revert InvalidMarket();
        if (m.resolved) revert MarketAlreadyResolved();

        m.resolved = true;
        m.outcome = outcome;

        emit MarketResolved(marketId, outcome);
    }

    // -----------------------------------------------------------------------
    // Liquidity hooks (PancakeRouter integration)
    // -----------------------------------------------------------------------

    /// @notice Add liquidity in BNB for the Yes or No outcome via PancakeRouter.
    /// @dev This mints tokens to this contract, approves router and calls addLiquidityETH.
    ///      Intended as a simple helper; in production you may want more control/params.
    /// @param marketId Market to provide liquidity for.
    /// @param yesSide true for Yes token / false for No token.
    /// @param tokenAmountDesired Amount of outcome tokens to pair with sent BNB.
    /// @param tokenAmountMin Minimum tokens to provide.
    /// @param bnbAmountMin Minimum BNB to add.
    /// @param deadline Transaction deadline for the router call.
    function addLiquidityBNB(
        uint256 marketId,
        bool yesSide,
        uint256 tokenAmountDesired,
        uint256 tokenAmountMin,
        uint256 bnbAmountMin,
        uint256 deadline
    ) external payable {
        Market storage m = markets[marketId];
        if (m.yesToken == address(0)) revert InvalidMarket();

        address token = yesSide ? m.yesToken : m.noToken;

        // Mint tokens to this contract and then add as liquidity.
        OutcomeToken(token).mint(address(this), tokenAmountDesired);
        OutcomeToken(token).approve(address(router), tokenAmountDesired);

        (uint256 amountToken, uint256 amountETH, ) = router.addLiquidityETH{value: msg.value}(
            token,
            tokenAmountDesired,
            tokenAmountMin,
            bnbAmountMin,
            msg.sender,
            deadline
        );

        // If any leftover tokens (due to min constraints), send them back to the provider.
        uint256 balance = OutcomeToken(token).balanceOf(address(this));
        if (balance > 0) {
            OutcomeToken(token).transfer(msg.sender, balance);
        }

        emit LiquidityAdded(marketId, msg.sender, yesSide, amountToken, amountETH);
    }

    // -----------------------------------------------------------------------
    // View helpers
    // -----------------------------------------------------------------------

    function getMarket(uint256 marketId) external view returns (Market memory) {
        Market memory m = markets[marketId];
        if (m.yesToken == address(0)) revert InvalidMarket();
        return m;
    }
}

