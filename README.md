# MonOps - Monad NFT Operations Dashboard

A batch operations and monitoring dashboard for NFTs on Monad mainnet (Chain ID: 143).

**Live Site**: [monops-six.vercel.app](https://monops-six.vercel.app)

## Features

### Core Features
- **Inventory**: View and manage NFT holdings across wallets
- **Mass Transfer**: Batch transfer NFTs with preflight checks
- **Token Streams**: Create vesting/streaming token payments
- **Holder Snapshots**: Build holder lists and export to CSV
- **Burn**: Permanently burn NFTs you own
- **Lock**: Time-lock NFTs in escrow contracts

### Technical Highlights
- **Monad Mainnet Only**: Network guardrails prevent usage on other chains
- **Local-First**: All data stored in IndexedDB (Dexie) - no backend required
- **Resumable Batches**: Sequential transaction execution with per-item status
- **100% Open Source**: All code is public and verifiable
- **Non-Custodial**: Your keys, your NFTs - we never have access

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
│   ├── inventory/         # NFT inventory
│   ├── transfer/          # Mass NFT transfer
│   ├── streams/           # Token streaming
│   ├── snapshots/         # Holder snapshots
│   ├── burn/              # NFT burning
│   ├── lock/              # NFT locking
│   ├── donate/            # Support page
│   ├── docs/              # Documentation
│   └── developer/         # Debug page
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── providers.tsx      # wagmi/RainbowKit providers
│   ├── sidebar.tsx        # Navigation sidebar
│   └── network-guard.tsx  # Chain validation
├── features/
│   ├── inventory/         # Collection & holdings
│   └── snapshots/         # Holder snapshot engine
├── hooks/
│   └── use-network-guard.ts
└── lib/
    ├── chain/             # Monad config, ABIs
    ├── db/                # Dexie database, plan limits
    ├── batch-engine/      # Batch execution engine
    └── utils.ts           # Helpers
```

## Usage

### 1. Connect Wallet
Click "Connect Wallet" and switch to Monad Mainnet if prompted.

### 2. View Inventory
Browse your NFT holdings in the **Inventory** page.

### 3. Mass Transfer
In **Transfer**, select NFTs, paste CSV data (recipient,tokenId), run preflight, and execute batch transfers.

### 4. Token Streams
Create vesting schedules or streaming payments in **Streams**.

### 5. Take Snapshots
Go to **Snapshots** to build and export holder lists for any collection.

### 6. Burn NFTs
Permanently destroy unwanted NFTs in the **Burn** page.

### 7. Lock NFTs
Time-lock NFTs in escrow via the **Lock** page.

## CSV Formats

### Mass Transfer
```csv
0x1234...abcd,1
0x5678...efgh,2
0x9abc...ijkl,3
```
For ERC-1155, add amount: `0x1234...abcd,1,5`

## Support Development

MonOps is free and open source. Donate to unlock premium features - your wallet gets whitelisted forever.

### Donation Wallets

| Chain | Address |
|-------|---------|
| Monad/EVM | `0x418e804EBe896D68B6e89Bf2401410e5DE6c701a` |
| Bitcoin | `bc1qn3dcjlr6gtdpv2dl3qmtk3ht27ztrt3vyefmsf` |
| Solana | `8zjNo9KkPEDUJSGsymZmSLku9aFU9Xdf7wNM5jqmdH3j` |

### Feature Limits

| Feature | Free | Supporter |
|---------|------|-----------|
| Batch Size | 10 | 1,000 |
| Export Rows | 100 | 10,000 |
| Watched Collections | 3 | 50 |
| Stored Wallets | 5 | 100 |

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
