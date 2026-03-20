import { Router, Request, Response } from "express";
import { getAllRates, getLiveRate, getSwapQuote } from "../services/stablefx";

export const fxRoutes = Router();

fxRoutes.get("/rates", async (_req: Request, res: Response) => {
  try {
    const rates = await getAllRates();
    res.json(rates);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

fxRoutes.get("/rate/:from/:to", async (req: Request, res: Response) => {
  try {
    const rate = await getLiveRate(req.params.from.toUpperCase(), req.params.to.toUpperCase());
    res.json(rate);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

fxRoutes.get("/quote", async (req: Request, res: Response) => {
  try {
    const { from, to, amount } = req.query;
    if (!from || !to || !amount) {
      return res.status(400).json({ error: "from, to, and amount are required" });
    }
    const quote = await getSwapQuote(
      String(from).toUpperCase(),
      String(to).toUpperCase(),
      parseFloat(String(amount))
    );
    res.json(quote);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
