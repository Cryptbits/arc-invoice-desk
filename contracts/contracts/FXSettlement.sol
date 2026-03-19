// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./InvoiceRegistry.sol";
import "./LendingPool.sol";

interface IStableFX {
    function getRate(bytes32 fromCurrency, bytes32 toCurrency) external view returns (uint256 rate, uint256 decimals);
    function executeSwap(
        bytes32 fromCurrency,
        bytes32 toCurrency,
        uint256 fromAmount,
        uint256 minToAmount,
        address recipient
    ) external returns (uint256 toAmount);
}

contract FXSettlement is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    InvoiceRegistry public immutable registry;
    LendingPool public immutable lendingPool;
    IStableFX public stableFX;

    IERC20 public immutable usdc;

    uint256 public constant SLIPPAGE_BPS = 50;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant PROTOCOL_FEE_BPS = 30;

    address public feeRecipient;
    uint256 public totalFeesCollected;

    mapping(bytes32 => address) public currencyTokens;

    event SettlementInitiated(uint256 indexed invoiceId, bytes32 fromCurrency, uint256 fromAmount);
    event FXSwapExecuted(uint256 indexed invoiceId, uint256 fromAmount, uint256 toAmount, uint256 fxRate);
    event SettlementComplete(uint256 indexed invoiceId, uint256 totalRepaid, uint256 feeCollected);

    constructor(
        address _registry,
        address _lendingPool,
        address _usdc,
        address _feeRecipient
    ) Ownable(msg.sender) {
        registry = InvoiceRegistry(_registry);
        lendingPool = LendingPool(_lendingPool);
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
    }

    function setStableFX(address _stableFX) external onlyOwner {
        stableFX = IStableFX(_stableFX);
    }

    function registerCurrency(bytes32 symbol, address tokenAddress) external onlyOwner {
        currencyTokens[symbol] = tokenAddress;
    }

    function settle(
        uint256 invoiceId,
        uint256 auctionId,
        uint256 paymentAmount,
        bytes32 paymentCurrency
    ) external nonReentrant {
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(invoiceId);
        require(inv.status == InvoiceRegistry.InvoiceStatus.Funded, "Invoice not funded");
        require(block.timestamp >= inv.dueDate, "Invoice not due yet");

        address paymentToken = currencyTokens[paymentCurrency];
        require(paymentToken != address(0), "Currency not supported");

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), paymentAmount);

        uint256 usdcReceived;

        if (paymentCurrency == bytes32("USDC")) {
            usdcReceived = paymentAmount;
        } else {
            usdcReceived = _executeStableFXSwap(invoiceId, paymentToken, paymentAmount, paymentCurrency);
        }

        uint256 fee = (usdcReceived * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netRepayment = usdcReceived - fee;

        totalFeesCollected += fee;
        usdc.safeTransfer(feeRecipient, fee);

        usdc.safeTransfer(address(lendingPool), netRepayment);
        lendingPool.recordRepayment(auctionId, netRepayment);

        registry.burnOnSettle(invoiceId, usdcReceived);

        emit SettlementComplete(invoiceId, netRepayment, fee);
    }

    function _executeStableFXSwap(
        uint256 invoiceId,
        address fromToken,
        uint256 fromAmount,
        bytes32 fromCurrency
    ) internal returns (uint256) {
        require(address(stableFX) != address(0), "StableFX not configured");

        IERC20(fromToken).forceApprove(address(stableFX), fromAmount);

        (uint256 rate, uint256 decimals) = stableFX.getRate(fromCurrency, bytes32("USDC"));
        uint256 expectedOut = (fromAmount * rate) / (10 ** decimals);
        uint256 minOut = (expectedOut * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;

        uint256 received = stableFX.executeSwap(
            fromCurrency,
            bytes32("USDC"),
            fromAmount,
            minOut,
            address(this)
        );

        emit FXSwapExecuted(invoiceId, fromAmount, received, rate);
        return received;
    }

    function getSettlementQuote(
        bytes32 fromCurrency,
        uint256 fromAmount
    ) external view returns (uint256 expectedUsdc, uint256 fxRate) {
        if (fromCurrency == bytes32("USDC")) {
            return (fromAmount, 1e6);
        }
        (uint256 rate, uint256 decimals) = stableFX.getRate(fromCurrency, bytes32("USDC"));
        expectedUsdc = (fromAmount * rate) / (10 ** decimals);
        fxRate = rate;
    }

    function updateFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }
}
