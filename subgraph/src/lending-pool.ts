import { BigInt } from "@graphprotocol/graph-ts";
import {
  Deposited,
  BidPlaced,
  AuctionCleared,
  RepaymentClaimed,
} from "../generated/LendingPool/LendingPool";
import {
  Bid,
  Deposit,
  Auction,
  LenderSummary,
  ProtocolMetrics,
} from "../generated/schema";

function getOrCreateLender(address: string, timestamp: BigInt): LenderSummary {
  let lender = LenderSummary.load(address);
  if (!lender) {
    lender = new LenderSummary(address);
    lender.address = Uint8Array.wrap(changetype<ArrayBuffer>(address));
    lender.totalDeposited = BigInt.fromI32(0);
    lender.totalActive = BigInt.fromI32(0);
    lender.totalYieldEarned = BigInt.fromI32(0);
    lender.bidCount = BigInt.fromI32(0);
    lender.updatedAt = timestamp;
  }
  return lender;
}

function getOrCreateMetrics(timestamp: BigInt): ProtocolMetrics {
  let metrics = ProtocolMetrics.load("global");
  if (!metrics) {
    metrics = new ProtocolMetrics("global");
    metrics.totalInvoices = BigInt.fromI32(0);
    metrics.totalVolumeUSDC = BigInt.fromI32(0);
    metrics.totalAdvancedUSDC = BigInt.fromI32(0);
    metrics.totalSettledUSDC = BigInt.fromI32(0);
    metrics.totalYieldPaidUSDC = BigInt.fromI32(0);
    metrics.activeLenders = BigInt.fromI32(0);
    metrics.updatedAt = timestamp;
  }
  return metrics;
}

export function handleDeposited(event: Deposited): void {
  const depositId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const deposit = new Deposit(depositId);
  deposit.lender = event.params.lender;
  deposit.amount = event.params.amount;
  deposit.timestamp = event.block.timestamp;
  deposit.txHash = event.transaction.hash;
  deposit.save();

  const lenderAddr = event.params.lender.toHexString();
  const lender = getOrCreateLender(lenderAddr, event.block.timestamp);
  lender.totalDeposited = lender.totalDeposited.plus(event.params.amount);
  lender.updatedAt = event.block.timestamp;
  lender.save();

  const metrics = getOrCreateMetrics(event.block.timestamp);
  metrics.updatedAt = event.block.timestamp;
  metrics.save();
}

export function handleBidPlaced(event: BidPlaced): void {
  const bidId = event.params.auctionId.toString() + "-" + event.params.lender.toHexString();

  const bid = new Bid(bidId);
  bid.auction = event.params.auctionId.toString();
  bid.lender = event.params.lender;
  bid.amount = event.params.amount;
  bid.discountBps = event.params.discountBps;
  bid.accepted = false;
  bid.timestamp = event.block.timestamp;
  bid.save();

  const lenderAddr = event.params.lender.toHexString();
  const lender = getOrCreateLender(lenderAddr, event.block.timestamp);
  lender.bidCount = lender.bidCount.plus(BigInt.fromI32(1));
  lender.updatedAt = event.block.timestamp;
  lender.save();
}

export function handleAuctionCleared(event: AuctionCleared): void {
  const auctionId = event.params.auctionId.toString();

  let auction = Auction.load(auctionId);
  if (!auction) {
    auction = new Auction(auctionId);
    auction.invoiceId = event.params.auctionId;
    auction.invoice = auctionId;
    auction.startTime = event.block.timestamp;
    auction.endTime = event.block.timestamp;
    auction.cleared = false;
  }

  auction.cleared = true;
  auction.clearingDiscountBps = event.params.discountBps;
  auction.advanceAmount = event.params.advanceAmount;
  auction.clearedAt = event.block.timestamp;
  auction.save();

  const metrics = getOrCreateMetrics(event.block.timestamp);
  metrics.totalAdvancedUSDC = metrics.totalAdvancedUSDC.plus(event.params.advanceAmount);
  metrics.updatedAt = event.block.timestamp;
  metrics.save();
}

export function handleRepaymentClaimed(event: RepaymentClaimed): void {
  const lenderAddr = event.params.lender.toHexString();
  const lender = getOrCreateLender(lenderAddr, event.block.timestamp);
  lender.totalYieldEarned = lender.totalYieldEarned.plus(event.params.yield_);
  lender.totalActive = lender.totalActive.minus(event.params.amount);
  lender.updatedAt = event.block.timestamp;
  lender.save();

  const metrics = getOrCreateMetrics(event.block.timestamp);
  metrics.totalYieldPaidUSDC = metrics.totalYieldPaidUSDC.plus(event.params.yield_);
  metrics.updatedAt = event.block.timestamp;
  metrics.save();
}
