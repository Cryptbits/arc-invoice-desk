# Arc Invoice Desk

**Institutional invoice discounting powered by Arc Network and Circle StableFX.**

Turn unpaid invoices into instant USDC liquidity. Lenders compete in Dutch auctions for the best discount rate. Circle StableFX settles in any stablecoin, in under a second.

---

## What makes this different

Every core feature of this product only works because of something Arc specifically provides:

| Feature | Arc primitive used |
|---|---|
| Shielded bid amounts | Opt-in privacy |
| Atomic FX settlement | Circle StableFX |
| Cross-chain lender deposits | Circle CCTP v2 |
| Sub-second confirmation | Malachite BFT consensus |
| Gasless UX | USDC-denominated fees |

---

## How it works

1. **Tokenise** — seller uploads invoice, minted as ERC-721 NFT on Arc with document hash stored on IPFS
2. **Auction** — 24-hour Dutch auction opens, lenders bid discount rates (amounts shielded on-chain)
3. **Advance** — USDC advance released to seller wallet immediately after auction clears
4. **Settle** — buyer pays on due date in any stablecoin, StableFX converts to USDC atomically, lenders receive principal + yield

---

## Tech stack

| Layer | Technology |
|---|---|
| Blockchain | Arc Network (EVM, chain 5042002) |
| Smart contracts | Solidity 0.8.28, Hardhat, OpenZeppelin 5 |
| FX settlement | Circle StableFX |
| Cross-chain | Circle CCTP v2 |
| Wallets | Circle Developer-Controlled Wallets |
| Backend API | Node.js, Express, TypeScript, Bull, Postgres, Redis |
| Document storage | IPFS (Kubo) |
| Indexing | The Graph (Arc subgraph) |
| Frontend | Next.js 14, React Query, Recharts, Syne + IBM Plex Mono |
| Infrastructure | Docker Compose, WSL2 |

---

## Smart contracts

| Contract | Purpose |
|---|---|
| `InvoiceRegistry.sol` | ERC-721 invoice NFT — mints, escrows, and burns on settlement |
| `LendingPool.sol` | Dutch auction — accepts deposits, clears bids, releases advances |
| `FXSettlement.sol` | StableFX wrapper — converts buyer payment currency to USDC atomically |

---

## Project structure

```
invoice-desk/
├── contracts/          Hardhat + Solidity
├── backend/            Node.js API (Express + Bull + Postgres)
├── frontend/           Next.js 14 App Router
├── subgraph/           The Graph subgraph for Arc
└── docker-compose.yml  Postgres + Redis + IPFS
```

---

## Local development

### Prerequisites

- Node.js 20 (via nvm)
- pnpm
- Foundry
- Docker + Docker Compose

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/arc-invoice-desk
cd arc-invoice-desk
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY and CIRCLE_API_KEY in .env

docker compose up -d

cd contracts && pnpm install && pnpm compile && pnpm test
pnpm deploy:testnet

cd ../backend && pnpm install && pnpm dev

cd ../frontend && pnpm install && pnpm dev
```

Open `http://localhost:3000`

---

## Environment variables

```env
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
DEPLOYER_PRIVATE_KEY=0x...
CIRCLE_API_KEY=...
DATABASE_URL=postgresql://dev:dev@localhost:5432/invoicedesk
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Vercel deployment

The frontend deploys to Vercel as a standalone Next.js app. The backend requires a server (Railway, Render, or Fly.io).

Set these environment variables in Vercel:
- `NEXT_PUBLIC_API_URL` — your deployed backend URL
- `NEXT_PUBLIC_CHAIN_ID` — `5042002`
- `NEXT_PUBLIC_RPC_URL` — `https://rpc.testnet.arc.network`

---

## License

MIT
