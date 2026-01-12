# MonOps - Monad NFT Operations Dashboard

A batch operations and monitoring dashboard for NFTs on Monad mainnet (Chain ID: 143).

## Features

### Core Features (MVP)
- **Wallet Library**: Add and label multiple wallet addresses for tracking
- **Watched Collections**: Track ERC-721 and ERC-1155 collections per wallet
- **Inventory Scanner**: Sync NFT holdings by scanning Transfer events
- **Holder Snapshots**: Build holder lists and export to CSV
- **Mass Transfer**: Batch transfer NFTs with preflight checks
- **Disperse**: Send MON or ERC-20 tokens to multiple recipients
- **Mint Monitor**: Watch live mints for collections via WebSocket

### Technical Highlights
- **Monad Mainnet Only**: Network guardrails prevent usage on other chains
- **Local-First**: All data stored in IndexedDB (Dexie) - no backend required
- **Resumable Batches**: Sequential transaction execution with per-item status
- **Plan Scaffolding**: Free/Pro limits ready for monetization

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Web3**: wagmi v2 + viem + RainbowKit
- **Storage**: IndexedDB via Dexie
- **CSV Parsing**: PapaParse

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd monops

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Edit .env.local with your values
# - Get a WalletConnect Project ID at https://cloud.walletconnect.com
```

### Environment Variables

```env
# Monad Mainnet RPC (public endpoint)
NEXT_PUBLIC_MONAD_RPC_URL=https://rpc.monad.xyz
NEXT_PUBLIC_MONAD_WS_URL=wss://rpc.monad.xyz

# WalletConnect Project ID (required for RainbowKit)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard
│   ├── wallets/           # Wallet library
│   ├── inventory/         # NFT inventory
│   ├── snapshots/         # Holder snapshots
│   ├── transfer/          # Mass NFT transfer
│   ├── disperse/          # Token disperse
│   ├── mint-monitor/      # Live mint monitoring
│   └── developer/         # Debug page
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── providers.tsx      # wagmi/RainbowKit providers
│   ├── header.tsx         # Navigation
│   └── network-guard.tsx  # Chain validation
├── features/
│   ├── wallet-library/    # Wallet management
│   ├── inventory/         # Collection & holdings
│   ├── snapshots/         # Holder snapshot engine
│   └── mint-monitor/      # WebSocket mint watching
├── hooks/
│   └── use-network-guard.ts
└── lib/
    ├── chain/             # Monad config, ABIs
    ├── db/                # Dexie database, plan limits
    ├── batch-engine/      # Batch execution engine
    ├── adapters/          # Marketplace adapters (stub)
    └── utils.ts           # Helpers
```

## Usage

### 1. Connect Wallet
Click "Connect Wallet" and switch to Monad Mainnet if prompted.

### 2. Add Wallets
Go to **Wallets** tab and add addresses you want to track.

### 3. Watch Collections
In **Inventory**, select a wallet and add NFT collection addresses to watch.

### 4. Sync Holdings
Click the sync button to scan Transfer events and build the holdings list.

### 5. Take Snapshots
Go to **Snapshots** to build and export holder lists for any collection.

### 6. Mass Transfer
In **Transfer**, select a collection, paste CSV data (recipient,tokenId), run preflight, and execute.

### 7. Disperse Tokens
In **Disperse**, choose MON or ERC-20, paste CSV data (address,amount), and execute.

## CSV Formats

### Mass Transfer
```csv
0x1234...abcd,1
0x5678...efgh,2
0x9abc...ijkl,3
```
For ERC-1155, add amount: `0x1234...abcd,1,5`

### Disperse
```csv
0x1234...abcd,1.5
0x5678...efgh,2.0
0x9abc...ijkl,0.5
```
Amounts in MON (or token units for ERC-20).

## Plan Limits

| Feature | Free | Pro |
|---------|------|-----|
| Batch Size | 10 | 1,000 |
| Export Rows | 100 | 10,000 |
| Watched Collections | 3 | 50 |
| Stored Wallets | 5 | 100 |

Toggle plans in the **Developer** page for testing.

## Marketplace Adapters

The codebase includes a `MarketplaceAdapter` interface with a stub implementation. To integrate real marketplaces:

1. Implement the interface in `src/lib/adapters/marketplace.ts`
2. Add your API keys to environment variables
3. Update `getMarketplaceAdapter()` to return your implementation

Methods to implement:
- `getFloor(collection)` - Floor price
- `getListings(wallet, collection?)` - Active listings
- `createListing(...)` - List an NFT
- `cancelListing(...)` - Cancel listing
- `getCollectionOffers(...)` - Collection offers
- `createCollectionOffer(...)` - Make offer
- `cancelOffer(...)` - Cancel offer

## Network Configuration

MonOps is hardcoded for Monad Mainnet:
- **Chain ID**: 143
- **Symbol**: MON
- **RPC**: https://rpc.monad.xyz (QuickNode, 25 rps)
- **WebSocket**: wss://rpc.monad.xyz
- **Explorer**: https://explorer.monad.xyz

Alternative public RPCs (configured in `.env.local`):
- `https://rpc1.monad.xyz` (Alchemy, 15 rps)
- `https://rpc3.monad.xyz` (Ankr, 30 rps burst)

## License

MIT
