import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseEther, type Hash, defineChain } from 'viem';

// Define chain inline to avoid import issues
const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
});

// Donation wallet address
const DONATION_WALLET = '0x418e804EBe896D68B6e89Bf2401410e5DE6c701a';

const client = createPublicClient({
  chain: monadMainnet,
  transport: http(),
});

const MIN_DONATION = parseEther('1'); // 1 MON minimum

export async function POST(request: NextRequest) {
  try {
    const { txHash, walletAddress } = await request.json();

    if (!txHash || !walletAddress) {
      return NextResponse.json(
        { error: 'Transaction hash and wallet address are required' },
        { status: 400 }
      );
    }

    // Fetch the transaction
    const tx = await client.getTransaction({ hash: txHash as Hash });

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify the transaction
    const donationWallet = DONATION_WALLET.toLowerCase();
    const fromAddress = tx.from.toLowerCase();
    const toAddress = tx.to?.toLowerCase();
    const userAddress = walletAddress.toLowerCase();

    // Check if sender matches the user
    if (fromAddress !== userAddress) {
      return NextResponse.json(
        { error: 'Transaction sender does not match your wallet', verified: false },
        { status: 400 }
      );
    }

    // Check if recipient is the donation wallet
    if (toAddress !== donationWallet) {
      return NextResponse.json(
        { error: 'Transaction is not to the donation wallet', verified: false },
        { status: 400 }
      );
    }

    // Check minimum amount
    if (tx.value < MIN_DONATION) {
      return NextResponse.json(
        { error: 'Donation must be at least 1 MON', verified: false },
        { status: 400 }
      );
    }

    // Transaction is verified!
    return NextResponse.json({
      verified: true,
      txHash,
      from: fromAddress,
      amount: tx.value.toString(),
      message: 'Donation verified! You are now a supporter.',
    });

  } catch (error) {
    console.error('[Verify Donation API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
