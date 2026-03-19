import { Router, Request, Response } from "express";
import { z } from "zod";
import { getLiveRate, getSwapQuote, getAllRates } from "../services/stablefx";

export const fxRoutes = Router();

fxRoutes.get("/rates", async (_req: Request, res: Response) => {
  const rates = await getAllRates();
  res.json(rates);
});

fxRoutes.get("/rates/:from/:to", async (req: Request, res: Response) => {
  const { from, to } = req.params;
  const rate = await getLiveRate(from.toUpperCase(), to.toUpperCase());
  res.json(rate);
});

fxRoutes.get("/quote", async (req: Request, res: Response) => {
  const parsed = z
    .object({
      from: z.string(),
      to: z.string(),
      amount: z.coerce.number().positive(),
      slippageBps: z.coerce.number().optional(),
    })
    .safeParse(req.query);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { from, to, amount, slippageBps } = parsed.data;
  const quote = await getSwapQuote(
    from.toUpperCase(),
    to.toUpperCase(),
    amount,
    slippageBps
  );

  res.json(quote);
});
