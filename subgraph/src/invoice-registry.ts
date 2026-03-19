import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  InvoiceMinted,
  InvoiceEscrowed,
  InvoiceSettled,
  InvoiceDefaulted,
} from "../generated/InvoiceRegistry/InvoiceRegistry";
import { Invoice, ProtocolMetrics } from "../generated/schema";

function getOrCreateMetrics(): ProtocolMetrics {
  let metrics = ProtocolMetrics.load("global");
  if (!metrics) {
    metrics = new ProtocolMetrics("global");
    metrics.totalInvoices = BigInt.fromI32(0);
    metrics.totalVolumeUSDC = BigInt.fromI32(0);
    metrics.totalAdvancedUSDC = BigInt.fromI32(0);
    metrics.totalSettledUSDC = BigInt.fromI32(0);
    metrics.totalYieldPaidUSDC = BigInt.fromI32(0);
    metrics.activeLenders = BigInt.fromI32(0);
    metrics.updatedAt = BigInt.fromI32(0);
  }
  return metrics;
}

export function handleInvoiceMinted(event: InvoiceMinted): void {
  const id = event.params.id.toString();

  const invoice = new Invoice(id);
  invoice.tokenId = event.params.id;
  invoice.seller = event.params.seller;
  invoice.faceValue = event.params.faceValue;
  invoice.dueDate = event.params.dueDate;
  invoice.currency = Bytes.fromHexString("0x");
  invoice.documentHash = Bytes.fromHexString("0x");
  invoice.buyerName = "";
  invoice.description = "";
  invoice.status = "pending";
  invoice.createdAt = event.block.timestamp;
  invoice.save();

  const metrics = getOrCreateMetrics();
  metrics.totalInvoices = metrics.totalInvoices.plus(BigInt.fromI32(1));
  metrics.totalVolumeUSDC = metrics.totalVolumeUSDC.plus(event.params.faceValue);
  metrics.updatedAt = event.block.timestamp;
  metrics.save();
}

export function handleInvoiceEscrowed(event: InvoiceEscrowed): void {
  const invoice = Invoice.load(event.params.id.toString());
  if (!invoice) return;
  invoice.status = "escrowed";
  invoice.save();
}

export function handleInvoiceSettled(event: InvoiceSettled): void {
  const invoice = Invoice.load(event.params.id.toString());
  if (!invoice) return;
  invoice.status = "settled";
  invoice.settledAmount = event.params.settledAmount;
  invoice.settledAt = event.block.timestamp;
  invoice.save();

  const metrics = getOrCreateMetrics();
  metrics.totalSettledUSDC = metrics.totalSettledUSDC.plus(event.params.settledAmount);
  metrics.updatedAt = event.block.timestamp;
  metrics.save();
}

export function handleInvoiceDefaulted(event: InvoiceDefaulted): void {
  const invoice = Invoice.load(event.params.id.toString());
  if (!invoice) return;
  invoice.status = "defaulted";
  invoice.save();
}
