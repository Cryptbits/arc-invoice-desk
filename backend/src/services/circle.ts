let client: any = null;

function isConfigured(): boolean {
  const key = process.env.CIRCLE_API_KEY || "";
  return key.length > 10 && key !== "your_circle_api_key_here";
}

async function getClient() {
  if (!isConfigured()) return null;
  if (client) return client;
  try {
    const sdk = await import("@circle-fin/developer-controlled-wallets");
    const init = sdk.initiateUserControlledWalletsClient || (sdk as any).default?.initiateUserControlledWalletsClient;
    if (typeof init === "function") {
      client = init({ apiKey: process.env.CIRCLE_API_KEY! });
    }
  } catch {
    console.warn("[Circle] SDK import failed — wallet features disabled");
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
      metadata: [{ name: `Invoice Desk - ${userAddress}` }],
    });
    return res.data?.wallets?.[0] || null;
  } catch (e: any) {
    console.warn("[Circle] createWallet failed:", e?.message);
    return null;
  }
}

export async function getWalletBalance(walletId: string) {
  const c = await getClient();
  if (!c) return [];
  try {
    const res = await c.getWalletTokenBalance({ id: walletId });
    return res.data?.tokenBalances || [];
  } catch {
    return [];
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
  } catch (e: any) {
    console.warn("[Circle] transferUSDC failed:", e?.message);
    return null;
  }
}

export function circleConfigured(): boolean {
  return isConfigured();
}
