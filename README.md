# Arc Invoice Desk

**Invoice discounting at settlement speed — built on Arc Network.**

Arc Invoice Desk is a fully functional invoice financing marketplace where businesses turn unpaid invoices into instant USDC liquidity. Lenders compete in Dutch auctions for the best rate. Circle StableFX settles payments in any stablecoin. Everything confirms on Arc Network in under one second.

Live demo: [[arcinvoicedesk.vercel.app](https://arc-invoice-desk.vercel.app/dashboard/new-invoice)

## Why Arc makes this possible

This product uses four Arc-specific primitives simultaneously. Remove any one and the product stops working.

| Primitive | What it enables |
|---|---|
| Opt-in privacy | Bid amounts are shielded during the auction window. Competitors cannot see your rate in the mempool. |
| Circle StableFX | Buyers pay in EURC. Lenders receive USDC. Same atomic transaction. No FX exposure, no counterparty risk. |
| Circle CCTP v2 | Lenders deposit from Ethereum, Base, or Arbitrum directly into the Arc pool. No manual bridging. |
| Malachite BFT | Every transaction confirms in under one second. Invoice settlement is instant and final. |

---

## How it works

A business uploads an unpaid invoice. It is minted as an ERC-721 NFT on Arc Network with the document hash stored on IPFS. A 24-hour Dutch auction opens. Lenders bid discount rates — the lowest rate wins. The seller receives a USDC advance immediately. When the buyer pays on the due date, Circle StableFX converts the payment to USDC atomically and distributes principal plus yield to lenders.

---

## Smart contracts

| Contract | Purpose |
|---|---|
| InvoiceRegistry.sol | ERC-721 NFT — mints, escrows, and burns invoices |
| LendingPool.sol | Dutch auction — accepts deposits, clears bids, releases advances |
| FXSettlement.sol | StableFX wrapper — converts buyer currency to USDC atomically |

Deployed on Arc Testnet, chain 5042002.

---

## Tech stack

| Layer | Technology |
|---|---|
| Blockchain | Arc Network, EVM, chain 5042002 |
| Smart contracts | Solidity 0.8.28, Hardhat, OpenZeppelin 5 |
| FX settlement | Circle StableFX |
| Cross-chain deposits | Circle CCTP v2 |
| Bid privacy | Arc opt-in privacy, commit-reveal scheme |
| Backend API | Node.js, Express, TypeScript |
| Job queue | Bull with Redis |
| Database | PostgreSQL |
| Document storage | IPFS |
| Indexing | The Graph subgraph for Arc |
| Frontend | Next.js 14 App Router, React Query, Recharts, mobile responsive |
| Wallet connect | RainbowKit, wagmi v2, viem |
| Infrastructure | Vercel, Render, Supabase, Redis Cloud |

---

## Project structure

```
arc-invoice-desk/
├── contracts/          Hardhat project — Solidity contracts and 21 tests
├── backend/            Node.js Express API
│   └── src/
│       ├── routes/     invoices, lenders, settlement, fx, cctp, documents, privacy
│       ├── services/   db, stablefx, cctp, ipfs, circle, fraud
│       └── jobs/       Bull queue — auction clearing, settlement execution
├── frontend/           Next.js 14 App Router
│   └── src/
│       ├── app/        dashboard, lender portal, settlement pages
│       ├── components/ Sidebar, WalletButton
│       └── lib/        api helpers, wagmi config
├── subgraph/           The Graph subgraph for Arc events
└── docker-compose.yml  Local dev — Postgres, Redis, IPFS
```

---

## Running locally

Prerequisites: Node.js 20, pnpm, Docker

```bash
# Start local services
docker compose up -d

# Backend
export DATABASE_URL="postgresql://dev:dev@localhost:5432/invoicedesk"
export REDIS_URL="redis://localhost:6379"
cd backend && pnpm install && pnpm dev

# Frontend (new terminal)
cd frontend && pnpm install && pnpm dev
```

Open http://localhost:3000

---

## Environment variables

**Backend (.env)**

```
DATABASE_URL          = postgresql://...
REDIS_URL             = redis://...
ARC_RPC_URL           = https://rpc.testnet.arc.network
CIRCLE_API_KEY        = your_circle_sandbox_key
CIRCLE_WALLET_SET_ID  = your_wallet_set_id
FRONTEND_URL          = http://localhost:3000
PORT                  = 3001
NODE_ENV              = development
```

**Frontend (.env.local)**

```
NEXT_PUBLIC_API_URL                  = http://localhost:3001
NEXT_PUBLIC_CHAIN_ID                 = 5042002
NEXT_PUBLIC_RPC_URL                  = https://rpc.testnet.arc.network
NEXT_PUBLIC_APP_URL                  = http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = your_walletconnect_project_id
```

---

## Deploying to production

**Frontend** — Vercel. Set Root Directory to `frontend`.

**Backend** — Render. Set Root Directory to `backend`. Build command: `pnpm install && pnpm build`. Start command: `pnpm start`.

**Database** — Supabase free tier. Use the Session Pooler connection string.

**Redis** — Redis Cloud free tier.

Full step-by-step guide is in DEMO_AND_DEPLOY.md.

---

## Anti-fraud system

Every invoice is scored 0 to 100 before being accepted. The scoring engine checks face value thresholds, due date proximity, submission rate per wallet address, cumulative daily volume, and missing descriptions. Scores below 40 are rejected. Scores 40 to 70 are flagged. Scores above 70 are approved automatically.

---

## API endpoints

```
GET  /health
GET  /api/invoices
POST /api/invoices
POST /api/invoices/:id/start-auction
GET  /api/invoices/:id
POST /api/lenders/register
POST /api/lenders/deposit
POST /api/lenders/bid
GET  /api/lenders/:address/portfolio
GET  /api/settlement/quote/:id
POST /api/settlement/execute
GET  /api/fx/rates
GET  /api/cctp/chains
POST /api/cctp/deposit
POST /api/documents/upload/:id
POST /api/privacy/commit
GET  /api/metrics/overview
```

---

## Contract tests

21 tests passing across deployment, invoice registry, lending pool, FX settlement, and full lifecycle integration including seller advance, lender yield, protocol fee collection, and NFT burn on settlement.

---

## License

MIT
