// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FalcoCore.sol";
import "../src/interfaces/IPyth.sol";

/// @dev Minimal ERC-20 for testing
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8  public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }
}

/// @dev Pyth mock: returns configurable price + age
contract MockPyth {
    int64  public price = 100_000_000_000; // $100,000 (8 dec)
    uint   public publishTime;

    constructor() { publishTime = block.timestamp; }

    function setPrice(int64 _price) external { price = _price; }
    function setAge(uint age) external { publishTime = block.timestamp - age; }

    function getPriceNoOlderThan(bytes32, uint maxAge)
        external view returns (PythStructs.Price memory)
    {
        require(block.timestamp - publishTime <= maxAge, "Pyth: stale");
        return PythStructs.Price({
            price:       price,
            conf:        0,
            expo:        -8,
            publishTime: publishTime
        });
    }
}

contract FalcoCoreTest is Test {
    FalcoCore public core;
    MockUSDC  public usdc;
    MockPyth  public pyth;

    address admin    = address(1);
    address treasury = address(2);
    address alice    = address(3);
    address bob      = address(4);

    bytes32 constant FEED = bytes32(uint256(1));
    uint128 constant SEED = 10_000_000; // 10 USDC

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();
        vm.prank(admin);
        core = new FalcoCore(admin, treasury, address(usdc), address(pyth), 100); // 1% fee

        // fund treasury for seed liquidity
        usdc.mint(treasury, 100_000_000);
        vm.prank(treasury);
        usdc.approve(address(core), type(uint256).max);

        // fund alice & bob
        usdc.mint(alice, 10_000_000);
        usdc.mint(bob,   10_000_000);
        vm.prank(alice); usdc.approve(address(core), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(core), type(uint256).max);
    }

    // ─── helpers ────────────────────────────────

    function _createAndOpenMarket() internal returns (uint32 id) {
        vm.startPrank(admin);
        id = core.createMarket(
            uint64(block.timestamp),
            uint64(block.timestamp + 300),
            FEED
        );
        core.openMarket(id, SEED);
        vm.stopPrank();
    }

    function _registerAndDeposit(address agent, uint128 amount) internal {
        vm.startPrank(agent);
        core.registerAgent();
        core.deposit(amount);
        vm.stopPrank();
    }

    // ─── Market lifecycle ────────────────────────

    function test_createMarket() public {
        vm.prank(admin);
        uint32 id = core.createMarket(
            uint64(block.timestamp + 10),
            uint64(block.timestamp + 310),
            FEED
        );
        assertEq(id, 0);
        assertEq(core.marketCount(), 1);
        FalcoCore.Market memory m = core.getMarket(id);
        assertEq(uint8(m.status), uint8(FalcoCore.MarketStatus.Pending));
    }

    function test_openMarket() public {
        uint32 id = _createAndOpenMarket();
        FalcoCore.Market memory m = core.getMarket(id);
        assertEq(uint8(m.status), uint8(FalcoCore.MarketStatus.Open));
        assertEq(m.yesReserve, SEED);
        assertEq(m.noReserve,  SEED);
        assertEq(m.strike, pyth.price());
    }

    function test_haltAndResumeMarket() public {
        uint32 id = _createAndOpenMarket();
        vm.prank(admin); core.haltMarket(id);
        assertEq(uint8(core.getMarket(id).status), uint8(FalcoCore.MarketStatus.Halted));
        vm.prank(admin); core.resumeMarket(id);
        assertEq(uint8(core.getMarket(id).status), uint8(FalcoCore.MarketStatus.Open));
    }

    function test_closeMarket_yesWins() public {
        uint32 id = _createAndOpenMarket();
        // price stays above strike → YES wins
        vm.prank(admin); core.closeMarket(id);
        FalcoCore.Market memory m = core.getMarket(id);
        assertEq(uint8(m.status), uint8(FalcoCore.MarketStatus.Closed));
        assertEq(uint8(m.winner), uint8(FalcoCore.Winner.Yes));
    }

    function test_closeMarket_noWins() public {
        uint32 id = _createAndOpenMarket();
        // lower price below strike
        pyth.setPrice(pyth.price() - 1);
        vm.prank(admin); core.closeMarket(id);
        assertEq(uint8(core.getMarket(id).winner), uint8(FalcoCore.Winner.No));
    }

    // ─── Agent registration & policy ────────────

    function test_registerAgent() public {
        vm.prank(alice);
        core.registerAgent();
        (,, bool reg) = core.getAgent(alice);
        assertTrue(reg);
    }

    function test_revert_registerTwice() public {
        vm.prank(alice); core.registerAgent();
        vm.prank(alice);
        vm.expectRevert(FalcoCore.AlreadyRegistered.selector);
        core.registerAgent();
    }

    function test_depositAndBalance() public {
        _registerAndDeposit(alice, 1_000_000);
        (uint128 bal,,) = core.getAgent(alice);
        assertEq(bal, 1_000_000);
    }

    function test_withdraw() public {
        _registerAndDeposit(alice, 1_000_000);
        vm.prank(alice);
        core.withdraw(500_000);
        (uint128 bal,,) = core.getAgent(alice);
        assertEq(bal, 500_000);
    }

    // ─── Happy path: place, cancel, settle ──────

    function test_placeBet_happy() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        vm.prank(alice);
        core.placeBet(id, FalcoCore.Side.Yes, 100_000);

        (uint128 bal,,) = core.getAgent(alice);
        assertEq(bal, 1_900_000);
    }

    function test_cancelBet_refunds() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        vm.prank(alice); core.placeBet(id, FalcoCore.Side.Yes, 100_000);
        vm.prank(alice); core.cancelBet(id);

        (uint128 bal,,) = core.getAgent(alice);
        // refund is slightly less than 100_000 due to CPMM slippage, but positive
        assertGt(bal, 1_899_000);
    }

    function test_settlePosition_winner() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        vm.prank(alice); core.placeBet(id, FalcoCore.Side.Yes, 100_000);

        // close market — price unchanged so YES wins
        vm.prank(admin); core.closeMarket(id);

        (uint128 balBefore,,) = core.getAgent(alice);
        vm.prank(alice); core.settlePosition(id);
        (uint128 balAfter,,) = core.getAgent(alice);
        assertGt(balAfter, balBefore); // received payout
    }

    function test_settlePosition_loser_zero_payout() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        vm.prank(alice); core.placeBet(id, FalcoCore.Side.No, 100_000);

        // YES wins (price >= strike)
        vm.prank(admin); core.closeMarket(id);

        (uint128 balBefore,,) = core.getAgent(alice);
        vm.prank(alice); core.settlePosition(id);
        (uint128 balAfter,,) = core.getAgent(alice);
        assertEq(balAfter, balBefore); // loser gets 0
    }

    // ─── Policy revert cases ─────────────────────

    function test_revert_overPolicyCap() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        // set max stake to 50_000
        vm.prank(alice);
        core.updatePolicy(FalcoCore.AgentPolicy({
            maxStakePerWindow: 50_000,
            maxOpenPositions:  4,
            allowedMarketsRoot: bytes32(0),
            paused: false
        }));

        vm.prank(alice);
        vm.expectRevert(FalcoCore.OverPolicyCap.selector);
        core.placeBet(id, FalcoCore.Side.Yes, 100_000); // exceeds cap
    }

    function test_revert_agentPaused() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        vm.prank(alice);
        core.updatePolicy(FalcoCore.AgentPolicy({
            maxStakePerWindow: 500_000_000,
            maxOpenPositions:  4,
            allowedMarketsRoot: bytes32(0),
            paused: true
        }));

        vm.prank(alice);
        vm.expectRevert(FalcoCore.AgentPaused.selector);
        core.placeBet(id, FalcoCore.Side.Yes, 100_000);
    }

    function test_revert_marketNotAllowed() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        // set allowedMarketsRoot to something that doesn't match FEED
        vm.prank(alice);
        core.updatePolicy(FalcoCore.AgentPolicy({
            maxStakePerWindow: 500_000_000,
            maxOpenPositions:  4,
            allowedMarketsRoot: bytes32(uint256(999)), // wrong root
            paused: false
        }));

        vm.prank(alice);
        vm.expectRevert(FalcoCore.MarketNotAllowed.selector);
        core.placeBet(id, FalcoCore.Side.Yes, 100_000);
    }

    function test_revert_tooManyPositions() public {
        // Create 4 separate markets and fill all 4 position slots
        _registerAndDeposit(alice, 10_000_000);

        uint32[] memory ids = new uint32[](5);
        for (uint i = 0; i < 5; i++) {
            vm.prank(admin);
            ids[i] = core.createMarket(
                uint64(block.timestamp),
                uint64(block.timestamp + 300),
                bytes32(uint256(i + 10))
            );
            // give each market a fresh price
            MockPyth freshPyth = new MockPyth();
            vm.prank(admin);
            // reuse same pyth, just create market with different feed ID
            // open market
            core.openMarket(ids[i], SEED);
        }

        // alice's default policy allows 4 open positions
        // place 4 bets → 5th should revert
        for (uint i = 0; i < 4; i++) {
            vm.prank(alice);
            core.placeBet(ids[i], FalcoCore.Side.Yes, 100_000);
        }

        vm.prank(alice);
        vm.expectRevert(FalcoCore.TooManyPositions.selector);
        core.placeBet(ids[4], FalcoCore.Side.Yes, 100_000);
    }

    function test_revert_oracleStale() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        // warp past ORACLE_MAX_AGE (30s) so publishTime is now stale
        vm.warp(block.timestamp + 31);

        vm.prank(alice);
        vm.expectRevert(); // Pyth mock reverts with "Pyth: stale"
        core.placeBet(id, FalcoCore.Side.Yes, 100_000);
    }

    function test_revert_betOnHaltedMarket() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 2_000_000);

        vm.prank(admin); core.haltMarket(id);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(FalcoCore.WrongStatus.selector, FalcoCore.MarketStatus.Halted));
        core.placeBet(id, FalcoCore.Side.Yes, 100_000);
    }

    function test_revert_insufficientBalance() public {
        uint32 id = _createAndOpenMarket();
        _registerAndDeposit(alice, 50_000); // only 0.05 USDC

        vm.prank(alice);
        vm.expectRevert(FalcoCore.InsufficientBalance.selector);
        core.placeBet(id, FalcoCore.Side.Yes, 100_000);
    }

    // ─── Admin auth ──────────────────────────────

    function test_revert_nonAdminCreateMarket() public {
        vm.prank(alice);
        vm.expectRevert(FalcoCore.Unauthorized.selector);
        core.createMarket(uint64(block.timestamp), uint64(block.timestamp + 100), FEED);
    }
}
