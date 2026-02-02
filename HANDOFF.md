# MonOps — IDE Migration Handoff

> Written Feb 2, 2026. For transitioning from Cursor to Google Antigravity (or any new IDE/AI assistant).

## Quick Start

```bash
git clone https://github.com/ibliminse/monops.git
cd monops
npm install
cp .env.local.example .env.local
# Fill in .env.local with your keys
npm run dev    # http://localhost:3000
npm run build  # Verify everything compiles
```

## Where to Find Everything

| What | File |
|------|------|
| AI assistant instructions | `CLAUDE.md` (IDE-agnostic, comprehensive) |
| All changes since Jan 12 | `CHANGELOG.md` |
| Environment variables | `.env.local.example` (all vars documented) |
| Project overview | `README.md` |
| This handoff | `HANDOFF.md` |
| Deployed contracts | `src/lib/contracts.ts` |
| Chain constants | `src/lib/chain/monad.ts` |
| Donation/plan limits | `src/lib/db/plan.ts` |

## Current State (Feb 2, 2026)

### What's Deployed
- **Vercel**: monops-six.vercel.app (auto-deploys from `main`)
- **Contracts**: TokenStream + TokenLock on Monad mainnet (Chain ID 143)
- **GitHub**: github.com/ibliminse/monops

### What Was Just Completed (6 Audit Batches)
A full security hardening pass was done across 6 batches covering:
- Centralized all duplicate constants (contract addresses, chain IDs, API URLs)
- Rate limiting, input validation, response validation on all API routes
- Security headers (CSP, HSTS, etc.), cookie consent, privacy/TOS pages
- Error boundary made data-safe (no auto-delete of IndexedDB)
- Dev-only logging in API routes
- Dead code removal (~700 lines)

Full checklist is in `CLAUDE.md` under "Security Audit Status".

### What's NOT Done (Low Priority)
- CSV address validation at parse time (addresses are validated at execution time, just no early UI feedback)
- `parseFloat` programmatic guards on amount inputs (form validation exists)
- No formal smart contract audit (disclosed in docs page)

## Architecture at a Glance

```
Browser (React)  ──→  Next.js API Routes  ──→  Moralis / Etherscan APIs
     │                      │
     ├── wagmi/viem ────────┤──→  Monad RPC (rpc.monad.xyz)
     │                      │
     └── IndexedDB (Dexie)  └──→  On-chain contracts (TokenStream, TokenLock)
```

- **No backend database**. All user data is in IndexedDB in the browser.
- **No server-side auth**. API routes only proxy external APIs + rate limit.
- **Non-custodial**. User signs every transaction. Server never touches keys.

## Critical Patterns (Will Bite You If Ignored)

### 1. Barrel Import Ban in API Routes
`src/lib/chain/index.ts` re-exports wagmi config, which imports RainbowKit (browser-only). If any API route imports from `@/lib/chain` instead of `@/lib/chain/monad` or `@/lib/chain/client`, it will crash at runtime with a cryptic `TypeError`.

```typescript
// ✅ API routes:
import { createServerClient } from '@/lib/chain/client';
import { MONAD_CHAIN_ID_HEX } from '@/lib/chain/monad';

// ❌ NEVER in API routes:
import { anything } from '@/lib/chain';
```

### 2. Two Viem Clients
- `getPublicClient()` — singleton for client-side code
- `createServerClient()` — fresh instance for API routes (serverless-safe)

Using the wrong one causes either stale state (singleton in serverless) or memory leaks (fresh instances in React).

### 3. Constants Are Centralized
Every constant has one canonical location. If you need a contract address, chain ID, or API URL, import it — don't define it locally. Check `CLAUDE.md` → "Key Constants" table.

## Deployment

- **Hosting**: Vercel (auto-deploys from `main` branch)
- **Domain**: monops-six.vercel.app
- **Env vars**: Set in Vercel dashboard (same keys as `.env.local.example`)
- **Build command**: `next build` (runs type-check + build)

## Testing

```bash
npm run build          # Full type-check + production build (main gate)
npm run test           # Hardhat contract tests
npm run test:coverage  # Contract coverage report
npm run lint           # ESLint
```

There are no unit tests for the frontend (yet). The build command catches type errors. Contract tests are comprehensive.

## Key Files by Importance

**Modify with care** (affect many features):
- `src/lib/chain/monad.ts` — all chain/API constants
- `src/lib/chain/client.ts` — viem client construction
- `src/lib/contracts.ts` — deployed contract addresses
- `src/lib/db/plan.ts` — donation wallet, plan limits
- `src/lib/rate-limit.ts` — API rate limiting
- `src/lib/batch-engine/` — transaction execution engine

**Largest/most complex pages**:
- `src/app/transfer/page.tsx` (~830 lines) — batch NFT transfer with CSV import
- `src/app/streams/create/page.tsx` — stream creation with batch mode

**API routes** (all follow the same pattern documented in CLAUDE.md):
- `src/app/api/nfts/route.ts`
- `src/app/api/tokens/route.ts`
- `src/app/api/snapshot/route.ts`
- `src/app/api/verify-donation/route.ts`

## Wallet / Donation Addresses

| Chain | Address | Used For |
|-------|---------|----------|
| Monad/EVM | `0x418e804EBe896D68B6e89Bf2401410e5DE6c701a` | Donations (defined in `plan.ts`) |
| Bitcoin | `bc1qn3dcjlr6gtdpv2dl3qmtk3ht27ztrt3vyefmsf` | Donations |
| Solana | `8zjNo9KkPEDUJSGsymZmSLku9aFU9Xdf7wNM5jqmdH3j` | Donations |

## For Your New AI Assistant

The `CLAUDE.md` file is written to be IDE-agnostic. It contains:
- Full architecture overview with file tree
- Every environment variable documented
- All design invariants and gotchas
- The mandatory changelog format
- Security audit checklist
- "Do NOT" rules

Point your new assistant at `CLAUDE.md` first. It has everything needed to work on this codebase safely.
