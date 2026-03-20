let client: any = null;

function isConfigured(): boolean {
  const key = process.env.CIRCLE_API_KEY || "";
  return key.length > 10 && key !== "your_circle_api_key_here" && key !== "sandbox_key_placeholder";
}

async function getClient() {
  if (!isConfigured()) return null;
  if (client) return client;
  try {
    const sdk = await import("@circle-fin/developer-controlled-wallets");
    const init =
      (sdk as any).initiateDeveloperControlledWalletsClient ||
      (sdk as any).initiateUserControlledWalletsClient ||
      (sdk as any).default?.initiateDeveloperControlledWalletsClient;
    if (typeof init === "function") {
      client = init({ apiKey: process.env.CIRCLE_API_KEY! });
    }
  } catch {
    console.warn("Circle SDK unavailable");
  }
  return client;
}

export async function createWallet(walletSetId: string, userAddress: string) {
  const c = await getClient();
  if (!c) return null;
  try {
    const res = await c.createWallets({
      walletSetId,
      blockchains: ["ARC"],
      count: 1,
      metadata: [{ name: `Arc Invoice Desk - ${userAddress}` }],
    });
    return res.data?.wallets?.[0] || null;
  } catch {
    return null;
  }
}

export async function transferUSDC(walletId: string, destinationAddress: string, amount: string) {
  const c = await getClient();
  if (!c) return null;
  try {
    const res = await c.createTransaction({
      walletId,
      tokenId: process.env.USDC_TOKEN_ID!,
      destinationAddress,
      amounts: [amount],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    return res.data?.transaction || null;
  } catch {
    return null;
  }
}

export function circleConfigured(): boolean {
  return isConfigured();
}
