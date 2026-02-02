# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MonOps is a non-custodial batch operations dashboard for the Monad blockchain (Chain ID 143). It runs entirely client-side — browser talks to RPC, user signs every transaction in their wallet, no backend database, no server-side auth. Deployed on Vercel at monops-six.vercel.app.

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Web3**: wagmi 2 + viem 2 + RainbowKit 2
- **Local DB**: Dexie (IndexedDB) — all user data lives in the browser
- **Contracts**: Solidity 0.8.20 (Hardhat, OpenZeppelin 5)
- **CSV**: PapaParse for import/export

## Commands

```
npm run dev          # Local dev server (localhost:3000)
npm run build        # Production build (type-checks everything)
npm run lint         # ESLint
npm run test         # Hardhat contract tests
npm run test:coverage # Contract test coverage
```

## Architecture

```
src/
  app/                  # Next.js pages + API routes
    api/
      nfts/             # GET — fetch NFTs via Moralis (fallback: Etherscan)
      tokens/           # GET — fetch ERC-20 balances
      snapshot/         # GET — build holder snapshot via ownerOf queries
      verify-donation/  # POST — verify donation tx on-chain
    page.tsx            # Dashboard
    inventory/          # NFT holdings viewer
    transfer/           # Batch NFT transfer (largest page, ~830 lines)
    burn/               # NFT burn with confirmation
    lock/               # Token time-lock (uses TokenLock contract)
    streams/            # Token vesting (uses TokenStream contract)
    snapshots/          # Holder snapshot builder + CSV export
    disperse/           # Multi-send MON or ERC-20
    donate/             # Donation page + verification
    docs/               # Security docs + FAQ + contract verification guide
    developer/          # Debug page (DB stats, env vars, chain info)
  components/           # Shared UI (sidebar, header, providers, donation prompt)
  features/
    inventory/          # Inventory scanner (log replay from RPC)
    snapshots/          # Snapshot types + CSV export helper
    disperse/           # Disperse feature logic
  hooks/                # use-network-guard, use-supporter-status, use-donation-prompt
  lib/
    chain/              # Monad config, ABIs, wagmi config, viem client
    contracts.ts        # Centralized contract addresses (single source of truth)
    db/                 # Dexie schema + plan limits (free vs supporter)
    batch-engine/       # Sequential batch execution with per-item status
    rate-limit.ts       # IP-based sliding-window rate limiter for API routes
    scanner/            # Token scanner, Monadscan API adapter
contracts/              # Solidity: TokenStream.sol, TokenLock.sol, test/MockERC20.sol
test/                   # Hardhat test suites for both contracts
```

## Viem Client Pattern (CRITICAL)

Two client constructors exist in `src/lib/chain/client.ts` — using the wrong one causes bugs:

- **`getPublicClient()`** — singleton, for client-side code (components, features, hooks). Reused across renders.
- **`createServerClient()`** — fresh instance per call, for API routes. Serverless-safe (no leaked state between invocations).

Both use `fallback()` transport with `rank: true` for automatic RPC failover.

### Barrel Import Gotcha

`src/lib/chain/index.ts` re-exports everything including wagmi config (`config.ts`), which pulls in browser-only RainbowKit code.

**API routes must NEVER import from `@/lib/chain`** — import directly from the specific file:
```typescript
// ✅ In API routes:
import { createServerClient } from '@/lib/chain/client';
import { MONAD_CHAIN_ID_HEX } from '@/lib/chain/monad';

// ❌ Causes runtime error in API routes:
import { createServerClient } from '@/lib/chain';
```

Client-side code can use either the barrel or direct imports.

## API Route Pattern

All API routes follow this structure:

1. **Rate limiting** at the top of the handler using `src/lib/rate-limit.ts`:
```typescript
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const { limited, retryAfterMs } = rateLimit('route-key', getClientIp(request), {
    windowMs: 60_000, maxRequests: 10
  });
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }
  // ... handler logic
}
```

2. **Moralis first, Etherscan fallback** for NFT and token routes.
3. **`incomplete` flag** returned when data may be partial (pagination interrupted, failed queries).

| Route | Method | Rate Limit |
|-------|--------|-----------|
| `/api/nfts` | GET | 10/60s |
| `/api/tokens` | GET | 10/60s |
| `/api/snapshot` | GET | 3/60s |
| `/api/verify-donation` | POST | 5/60s |

## Batch Engine Pattern

`src/lib/batch-engine/` implements a two-phase execution model used by transfer, burn, and disperse features:

**Phase 1 — Preflight**: Validate all items, estimate gas, check ownership. Returns `PreflightResult` with per-item validity.

**Phase 2 — Execute**: Sequential tx execution with callbacks for UI progress updates. Each item is sent one-at-a-time (prevents nonce conflicts). Batch state stored in IndexedDB via `batch-store.ts` for pause/resume.

```typescript
// Preflight
const result = await preflightNFTTransfers(items, signerAddress);
// result.valid, result.errors[], result.estimatedGas, result.itemResults[]

// Execute with progress callbacks
const batchId = await executeNFTTransfers(items, signerAddress, walletClient, {
  onItemStart: (index) => { ... },
  onItemComplete: (index, txHash, gasUsed) => { ... },
  onItemFailed: (index, error) => { ... },
  onBatchComplete: () => { ... },
});
```

## Page Layout Pattern

Feature pages use shared components from `src/components/ui/page-wrapper.tsx`:

```tsx
<PageWrapper>
  <PageHeader title="..." description="..." icon={<Icon />} action={<Button />} />
  <NetworkGuard>
    <AnimatedCard delay={0.1}>{/* content */}</AnimatedCard>
    <StatCard label="..." value="..." icon={<Icon />} gradient="..." />
    <EmptyState icon={<Icon />} title="..." action={<Button />} />
  </NetworkGuard>
</PageWrapper>
```

`NetworkGuard` blocks content and shows a chain-switch prompt when the wallet is on the wrong network.

## Deployed Contracts

| Contract | Address | Status |
|----------|---------|--------|
| TokenStream | `0x45060bA620768a20c792E60fbc6161344cA22a12` | Deployed — centralized in `src/lib/contracts.ts` |
| TokenLock | `0xC4Ca03a135B6dE0Dba430e28de5fe9C10cA99CB0` | Deployed — centralized in `src/lib/contracts.ts` |

Both contracts: no admin keys, no pause, no upgrade proxy, ReentrancyGuard, SafeERC20. Streams are **immutable** (no cancellation). Not formally audited (disclosed in docs).

## Key Constants

| What | Where | Value |
|------|-------|-------|
| Chain ID (decimal) | `src/lib/chain/monad.ts` | 143 |
| Chain ID (hex) | `src/lib/chain/monad.ts` | `0x8f` |
| Default RPC | `src/lib/chain/monad.ts` | `https://rpc.monad.xyz` |
| Block scan range | `src/lib/chain/monad.ts` | 500,000 (env-configurable via `NEXT_PUBLIC_SCAN_BLOCK_RANGE`) |
| Contract addresses | `src/lib/contracts.ts` | See Deployed Contracts table |
| Etherscan API base | `src/lib/chain/monad.ts` | `https://api.etherscan.io/v2/api` |
| Moralis API base | `src/lib/chain/monad.ts` | `https://deep-index.moralis.io/api/v2.2` |
| Donation wallet | `src/lib/db/plan.ts` | `0x418e804EBe896D68B6e89Bf2401410e5DE6c701a` |
| Min donation | `src/app/api/verify-donation/route.ts` | 1 MON |
| Free batch limit | `src/lib/db/plan.ts` | 10 items |
| Supporter batch limit | `src/lib/db/plan.ts` | 1,000 items |

## Design Invariants

These must hold unless deliberately overturned:

1. **Non-custodial** — no server ever holds keys or signs transactions
2. **User signs every tx** — no batched signing, no gasless relaying
3. **No admin keys on contracts** — no Ownable, no AccessControl, no proxy
4. **Exact approvals only** — approve the precise amount, never `type(uint256).max`
5. **On-chain data is truth** — external APIs (Moralis, Etherscan) are fallbacks, never authoritative
6. **IndexedDB is the only persistence** — no server database
7. **Monad-only** — network guard enforces Chain ID 143
8. **Batch execution is sequential** — one tx at a time, prevents nonce conflicts
9. **Donations are lifetime** — no subscriptions, no expiration

## Known Gotchas

**Silent failure in log scanning**: `inventory-scanner.ts` catches RPC errors per block range and continues. Failed ranges are tracked in `failedRanges` and surfaced via progress callbacks. The snapshot API (`/api/snapshot`) tracks `failedTokens` and returns `incomplete: true` when queries fail. Both the snapshots page and inventory page show amber warning banners when data is incomplete or from a fallback source.

**500k block window**: `DEFAULT_SCAN_BLOCK_RANGE` is 500,000 blocks (configurable via env var). As Monad ages, older collections will have incomplete data from log scanning. The API snapshot route uses `ownerOf` (current state) so it's unaffected.

**Client-side plan enforcement only**: Supporter limits (`plan.ts`) are checked in frontend code. There is no server-side enforcement. A user can edit localStorage to fake supporter status. This is a monetization concern, not a safety concern.

**Supporter status in localStorage**: Verified donations are cached in `localStorage` under `monops_verified_supporters`. No re-verification on subsequent sessions. Clearing localStorage resets status (user must re-verify).

**Cookie consent gates analytics**: Google Analytics only loads after the user accepts the consent banner (`src/components/consent-banner.tsx`). Consent stored in localStorage under `monops_analytics_consent`. The GA component listens for a custom `monops-consent-updated` event to react without page reload.

## Changelog

**MANDATORY — do this automatically on every task, no exceptions, no reminders needed.**

This project maintains a `CHANGELOG.md` at the project root. You MUST update it every time you create, edit, or change any file.

**Format:**

```markdown
## YYYY-MM-DD

- [HH:MM] Created `path/to/file` — short description of why
- [HH:MM] Edited `path/to/file` — what changed and why
- [HH:MM] Deleted `path/to/file` — reason
```

**Rules:**
1. Use the current date and time (24h format, local timezone) for every entry
2. Group entries under the current date heading — don't duplicate date headings if one already exists for today
3. Always specify whether the action was **Created**, **Edited**, or **Deleted**
4. Include the file path and a brief description of what was done
5. Append new entries at the top of the file, under the `---` separator, newest date first
6. Read the existing `CHANGELOG.md` before writing to avoid overwriting previous entries
7. Do this automatically as part of every task — never ask, never skip

## Do NOT

- Add server-side state or a database — the app is local-first by design
- Use unlimited token approvals (`type(uint256).max`)
- Add admin/owner roles to smart contracts
- Add a proxy pattern or upgradeability to contracts
- Gate safety features behind donation status
- Trust external API data as authoritative (always verify against chain)
- Assume docs are correct without checking the actual code/contracts
- Import from `@/lib/chain` barrel in API routes (use direct file imports)
