// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./InvoiceRegistry.sol";

contract LendingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    InvoiceRegistry public immutable registry;

    uint256 public constant MAX_DISCOUNT_BPS = 2000;
    uint256 public constant AUCTION_DURATION = 24 hours;
    uint256 public constant BPS_DENOMINATOR = 10000;

    address public fxSettlement;

    modifier onlySettlementOrOwner() {
        require(
            msg.sender == fxSettlement || msg.sender == owner(),
            "Not authorized: settlement or owner only"
        );
        _;
    }

    struct Bid {
        address lender;
        uint256 amount;
        uint256 discountBps;
        uint256 timestamp;
        bool accepted;
    }

    struct Auction {
        uint256 invoiceId;
        uint256 startTime;
        uint256 endTime;
        uint256 targetAmount;
        uint256 raisedAmount;
        bool cleared;
        bool cancelled;
        uint256 clearingDiscountBps;
        uint256[] bidIds;
    }

    struct LenderPosition {
        uint256 depositedAmount;
        uint256 activeAmount;
        uint256 totalYieldEarned;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => Bid) public bids;
    mapping(address => LenderPosition) public lenderPositions;
    mapping(address => uint256) public lenderDeposits;
    mapping(uint256 => uint256) public invoiceAuction;

    uint256 private _auctionCounter;
    uint256 private _bidCounter;
    uint256 public totalDeposited;
    uint256 public totalActiveLoans;

    event Deposited(address indexed lender, uint256 amount);
    event Withdrawn(address indexed lender, uint256 amount);
    event AuctionCreated(uint256 indexed auctionId, uint256 indexed invoiceId);
    event BidPlaced(uint256 indexed auctionId, address indexed lender, uint256 amount, uint256 discountBps);
    event AuctionCleared(uint256 indexed auctionId, uint256 discountBps, uint256 advanceAmount);
    event RepaymentClaimed(address indexed lender, uint256 amount, uint256 yield);

    constructor(address _usdc, address _registry) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        registry = InvoiceRegistry(_registry);
    }

    function setFxSettlement(address _fxSettlement) external onlyOwner {
        fxSettlement = _fxSettlement;
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        lenderDeposits[msg.sender] += amount;
        lenderPositions[msg.sender].depositedAmount += amount;
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        uint256 available = lenderDeposits[msg.sender] - lenderPositions[msg.sender].activeAmount;
        require(amount <= available, "Insufficient available balance");
        lenderDeposits[msg.sender] -= amount;
        lenderPositions[msg.sender].depositedAmount -= amount;
        totalDeposited -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function createAuction(uint256 invoiceId) external returns (uint256) {
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(invoiceId);
        require(inv.seller == msg.sender, "Not invoice owner");
        require(inv.status == InvoiceRegistry.InvoiceStatus.Pending, "Invalid status");

        registry.lockInEscrow(invoiceId);

        uint256 auctionId = ++_auctionCounter;
        Auction storage auction = auctions[auctionId];
        auction.invoiceId = invoiceId;
        auction.startTime = block.timestamp;
        auction.endTime = block.timestamp + AUCTION_DURATION;
        auction.targetAmount = inv.faceValue;

        invoiceAuction[invoiceId] = auctionId;

        emit AuctionCreated(auctionId, invoiceId);
        return auctionId;
    }

    function placeBid(
        uint256 auctionId,
        uint256 amount,
        uint256 discountBps
    ) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(block.timestamp < auction.endTime, "Auction ended");
        require(!auction.cleared && !auction.cancelled, "Auction not active");
        require(discountBps <= MAX_DISCOUNT_BPS, "Discount too high");
        require(amount > 0, "Amount must be positive");

        uint256 available = lenderDeposits[msg.sender] - lenderPositions[msg.sender].activeAmount;
        require(amount <= available, "Insufficient available balance");

        uint256 bidId = ++_bidCounter;
        bids[bidId] = Bid({
            lender: msg.sender,
            amount: amount,
            discountBps: discountBps,
            timestamp: block.timestamp,
            accepted: false
        });

        auction.bidIds.push(bidId);

        emit BidPlaced(auctionId, msg.sender, amount, discountBps);
    }

    function clearAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(!auction.cleared && !auction.cancelled, "Already processed");

        uint256[] memory bidIds = auction.bidIds;
        uint256 bidCount = bidIds.length;

        uint256[] memory sortedBidIds = _sortBidsByDiscount(bidIds, bidCount);

        uint256 raised = 0;
        uint256 clearingDiscount = 0;

        for (uint256 i = 0; i < bidCount; i++) {
            if (raised >= auction.targetAmount) break;

            uint256 bidId = sortedBidIds[i];
            Bid storage bid = bids[bidId];

            uint256 needed = auction.targetAmount - raised;
            uint256 fillAmount = bid.amount < needed ? bid.amount : needed;

            bid.accepted = true;
            bid.amount = fillAmount;
            lenderPositions[bid.lender].activeAmount += fillAmount;
            raised += fillAmount;
            clearingDiscount = bid.discountBps;
        }

        auction.raisedAmount = raised;
        auction.clearingDiscountBps = clearingDiscount;
        auction.cleared = true;

        uint256 advanceAmount = (raised * (BPS_DENOMINATOR - clearingDiscount)) / BPS_DENOMINATOR;

        registry.markFunded(auction.invoiceId);

        InvoiceRegistry.Invoice memory inv = registry.getInvoice(auction.invoiceId);
        usdc.safeTransfer(inv.seller, advanceAmount);

        totalActiveLoans += raised;

        emit AuctionCleared(auctionId, clearingDiscount, advanceAmount);
    }

    function _sortBidsByDiscount(
        uint256[] memory bidIds,
        uint256 count
    ) internal view returns (uint256[] memory) {
        uint256[] memory sorted = new uint256[](count);
        for (uint256 i = 0; i < count; i++) sorted[i] = bidIds[i];

        for (uint256 i = 0; i < count - 1; i++) {
            for (uint256 j = 0; j < count - i - 1; j++) {
                if (bids[sorted[j]].discountBps > bids[sorted[j + 1]].discountBps) {
                    uint256 temp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = temp;
                }
            }
        }
        return sorted;
    }

    function recordRepayment(uint256 auctionId, uint256 totalRepaid) external onlySettlementOrOwner {
        Auction storage auction = auctions[auctionId];
        require(auction.cleared, "Auction not cleared");

        uint256[] memory bidIds = auction.bidIds;
        uint256 remaining = totalRepaid;

        for (uint256 i = 0; i < bidIds.length; i++) {
            Bid storage bid = bids[bidIds[i]];
            if (!bid.accepted) continue;

            uint256 yieldBps = auction.clearingDiscountBps;
            uint256 yieldAmount = (bid.amount * yieldBps) / BPS_DENOMINATOR;
            uint256 repayment = bid.amount + yieldAmount;

            if (repayment > remaining) repayment = remaining;

            lenderPositions[bid.lender].activeAmount -= bid.amount;
            lenderPositions[bid.lender].totalYieldEarned += yieldAmount;
            remaining -= repayment;

            emit RepaymentClaimed(bid.lender, bid.amount, yieldAmount);
        }

        totalActiveLoans -= auction.raisedAmount;
    }

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function getBid(uint256 bidId) external view returns (Bid memory) {
        return bids[bidId];
    }

    function getLenderPosition(address lender) external view returns (LenderPosition memory) {
        return lenderPositions[lender];
    }

    function getAvailableBalance(address lender) external view returns (uint256) {
        return lenderDeposits[lender] - lenderPositions[lender].activeAmount;
    }
}
