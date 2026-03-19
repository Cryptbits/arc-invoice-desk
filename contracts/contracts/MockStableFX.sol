// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockStableFX {
    using SafeERC20 for IERC20;

    mapping(bytes32 => mapping(bytes32 => uint256)) public rates;
    mapping(bytes32 => address) public tokens;

    uint256 public constant RATE_DECIMALS = 6;

    constructor() {
        rates[bytes32("EURC")][bytes32("USDC")] = 1_085_000;
        rates[bytes32("USDC")][bytes32("EURC")] = 922_000;
        rates[bytes32("USDC")][bytes32("USDC")] = 1_000_000;
        rates[bytes32("EURC")][bytes32("EURC")] = 1_000_000;
    }

    function setRate(bytes32 from, bytes32 to, uint256 rate) external {
        rates[from][to] = rate;
    }

    function setToken(bytes32 symbol, address token) external {
        tokens[symbol] = token;
    }

    function getRate(bytes32 fromCurrency, bytes32 toCurrency)
        external
        view
        returns (uint256 rate, uint256 decimals)
    {
        rate = rates[fromCurrency][toCurrency];
        require(rate > 0, "MockStableFX: rate not set");
        decimals = RATE_DECIMALS;
    }

    function executeSwap(
        bytes32 fromCurrency,
        bytes32 toCurrency,
        uint256 fromAmount,
        uint256 minToAmount,
        address recipient
    ) external returns (uint256 toAmount) {
        uint256 rate = rates[fromCurrency][toCurrency];
        require(rate > 0, "MockStableFX: rate not set");

        toAmount = (fromAmount * rate) / (10 ** RATE_DECIMALS);
        require(toAmount >= minToAmount, "MockStableFX: slippage exceeded");

        address fromToken = tokens[fromCurrency];
        address toToken = tokens[toCurrency];
        require(fromToken != address(0), "MockStableFX: from token not set");
        require(toToken != address(0), "MockStableFX: to token not set");

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), fromAmount);
        IERC20(toToken).safeTransfer(recipient, toAmount);
    }

    function fundWithToken(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }
}
