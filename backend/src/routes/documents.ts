import { Router, Request, Response } from "express";
import { uploadToIPFS, uploadJSONToIPFS, getFromIPFS, isIPFSAvailable } from "../services/ipfs";
import { getDb } from "../services/db";

export const documentsRoutes = Router();

documentsRoutes.get("/health", async (_req: Request, res: Response) => {
  const available = await isIPFSAvailable();
  res.json({
    ipfs: available ? "online" : "offline",
    message: available ? "IPFS node is reachable" : "IPFS offline — document upload will be skipped",
    apiUrl: process.env.IPFS_API_URL || "http://localhost:5001",
  });
});

documentsRoutes.post("/upload/:invoiceId", async (req: Request, res: Response) => {
  const { invoiceId } = req.params;
  const db = getDb();

  const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [invoiceId]);
  if (!invoice.rows[0]) return res.status(404).json({ error: "Invoice not found" });

  const contentType = req.headers["content-type"] || "";
  const available = await isIPFSAvailable();

  if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
    const buffer: Buffer = (req as any).rawBody;
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "Empty file received. Check that the file was attached correctly." });
    }

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: "File too large. Maximum size is 10MB." });
    }

    if (!available) {
      const { createHash } = await import("crypto");
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      await db.query(
        "UPDATE invoices SET document_hash = $1, updated_at = NOW() WHERE id = $2",
        [sha256, invoiceId]
      );
      return res.json({
        cid: null,
        sha256,
        onChainHash: "0x" + sha256,
        message: "IPFS offline. Document hash recorded locally.",
        ipfsOffline: true,
      });
    }

    const result = await uploadToIPFS(buffer, `invoice-${invoiceId}.pdf`);
    await db.query(
      "UPDATE invoices SET ipfs_cid = $1, document_hash = $2, updated_at = NOW() WHERE id = $3",
      [result.cid, result.sha256, invoiceId]
    );

    return res.json({
      cid: result.cid,
      size: result.size,
      sha256: result.sha256,
      url: `http://localhost:8080/ipfs/${result.cid}`,
      onChainHash: "0x" + result.sha256,
      message: "PDF stored on IPFS. Use onChainHash when minting the NFT.",
    });
  }

  const metadata = req.body as Record<string, unknown>;
  const enriched = {
    ...metadata,
    invoiceId: parseInt(invoiceId),
    uploadedAt: new Date().toISOString(),
    seller: invoice.rows[0].seller_address,
    buyerName: invoice.rows[0].buyer_name,
    faceValue: invoice.rows[0].face_value,
    currency: invoice.rows[0].currency,
  };

  if (!available) {
    const { createHash } = await import("crypto");
    const sha256 = createHash("sha256").update(JSON.stringify(enriched)).digest("hex");
    await db.query(
      "UPDATE invoices SET document_hash = $1, updated_at = NOW() WHERE id = $2",
      [sha256, invoiceId]
    );
    return res.json({
      cid: null,
      sha256,
      onChainHash: "0x" + sha256,
      message: "IPFS offline. Metadata hash recorded locally.",
      ipfsOffline: true,
    });
  }

  const result = await uploadJSONToIPFS(enriched);
  await db.query(
    "UPDATE invoices SET ipfs_cid = $1, document_hash = $2, updated_at = NOW() WHERE id = $3",
    [result.cid, result.sha256, invoiceId]
  );

  return res.json({
    cid: result.cid,
    sha256: result.sha256,
    url: `http://localhost:8080/ipfs/${result.cid}`,
    onChainHash: "0x" + result.sha256,
    message: "Invoice metadata stored on IPFS.",
  });
});

documentsRoutes.get("/:cid", async (req: Request, res: Response) => {
  const { cid } = req.params;
  const buffer = await getFromIPFS(cid);
  const isPdf = buffer.slice(0, 4).toString("hex") === "25504446";
  res.set("Content-Type", isPdf ? "application/pdf" : "application/octet-stream");
  res.set("Content-Length", buffer.length.toString());
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(buffer);
});

documentsRoutes.get("/invoice/:invoiceId", async (req: Request, res: Response) => {
  const db = getDb();
  const result = await db.query(
    "SELECT ipfs_cid, document_hash FROM invoices WHERE id = $1",
    [req.params.invoiceId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Invoice not found" });
  if (!result.rows[0].ipfs_cid && !result.rows[0].document_hash) {
    return res.status(404).json({ error: "No document attached to this invoice" });
  }
  res.json({
    cid: result.rows[0].ipfs_cid,
    documentHash: result.rows[0].document_hash,
    url: result.rows[0].ipfs_cid ? `http://localhost:8080/ipfs/${result.rows[0].ipfs_cid}` : null,
    gatewayUrl: result.rows[0].ipfs_cid ? `https://ipfs.io/ipfs/${result.rows[0].ipfs_cid}` : null,
  });
});
