const CIRCLE_BASE = "https://api.circle.com/v1";

export interface FXRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  inverseRate: number;
  timestamp: string;
  source: "circle" | "fallback";
}

const FALLBACK_RATES: Record<string, number> = {
  "EURC-USDC": 1.085,
  "USDC-EURC": 0.922,
  "USDC-USDC": 1.0,
  "EURC-EURC": 1.0,
};

const rateCache = new Map<string, { rate: FXRate; cachedAt: number }>();
const CACHE_TTL = 30_000;

export async function getFXRate(from: string, to: string): Promise<FXRate> {
  const key = `${from}-${to}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.rate;
  }

  const apiKey = process.env.CIRCLE_API_KEY;
  if (apiKey && apiKey !== "your_circle_api_key_here" && apiKey.length > 10) {
    try {
      const res = await fetch(`${CIRCLE_BASE}/stablefx/rates?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const rate: FXRate = {
          fromCurrency: from,
          toCurrency: to,
          rate: parseFloat(data.data?.rate || FALLBACK_RATES[key] || "1"),
          inverseRate: parseFloat(data.data?.inverseRate || "1"),
          timestamp: new Date().toISOString(),
          source: "circle",
        };
        rateCache.set(key, { rate, cachedAt: Date.now() });
        return rate;
      }
    } catch {
      // Fall through to fallback
    }
  }

  const fallbackRate = FALLBACK_RATES[key] || 1.0;
  const rate: FXRate = {
    fromCurrency: from,
    toCurrency: to,
    rate: fallbackRate,
    inverseRate: 1 / fallbackRate,
    timestamp: new Date().toISOString(),
    source: "fallback",
  };
  rateCache.set(key, { rate, cachedAt: Date.now() });
  return rate;
}

export async function getAllRates(): Promise<FXRate[]> {
  const pairs = [["EURC", "USDC"], ["USDC", "EURC"]];
  return Promise.all(pairs.map(([from, to]) => getFXRate(from, to)));
}

export async function calculateSwap(from: string, to: string, amount: number) {
  const rate = await getFXRate(from, to);
  const toAmount = amount * rate.rate;
  const feeUSDC = toAmount * 0.003;
  return {
    fromCurrency: from,
    toCurrency: to,
    fromAmount: amount,
    toAmount: toAmount - feeUSDC,
    rate: rate.rate,
    feeUSDC,
    source: rate.source,
  };
}
