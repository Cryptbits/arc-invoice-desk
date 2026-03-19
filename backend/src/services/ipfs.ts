import { createHash } from "crypto";

const IPFS_API = process.env.IPFS_API_URL || "http://localhost:5001";

export interface IPFSUploadResult {
  cid: string;
  size: number;
  sha256: string;
  url: string;
}

export async function uploadToIPFS(
  buffer: Buffer,
  filename: string
): Promise<IPFSUploadResult> {
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const formData = new FormData();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  formData.append("file", blob, filename);

  const response = await fetch(`${IPFS_API}/api/v0/add?pin=true&wrap-with-directory=false`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.trim().split("\n");
  const result = JSON.parse(lines[lines.length - 1]);

  return {
    cid: result.Hash,
    size: result.Size,
    sha256,
    url: `http://localhost:8080/ipfs/${result.Hash}`,
  };
}

export async function uploadJSONToIPFS(
  data: Record<string, unknown>
): Promise<IPFSUploadResult> {
  const json = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(json, "utf-8");
  return uploadToIPFS(buffer, "metadata.json");
}

export async function getFromIPFS(cid: string): Promise<Buffer> {
  const response = await fetch(`${IPFS_API}/api/v0/cat?arg=${cid}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`IPFS retrieval failed for CID ${cid}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function pinCID(cid: string): Promise<void> {
  const response = await fetch(`${IPFS_API}/api/v0/pin/add?arg=${cid}`, {
    method: "POST",
  });

  if (!response.ok) {
    console.warn(`Failed to pin CID ${cid}: ${response.statusText}`);
  }
}

export function hashDocument(buffer: Buffer): string {
  return "0x" + createHash("sha256").update(buffer).digest("hex");
}

export async function isIPFSAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${IPFS_API}/api/v0/version`, {
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
