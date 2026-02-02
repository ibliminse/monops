import { NextRequest, NextResponse } from 'next/server';
import { parseEther, type Hash } from 'viem';
import { createServerClient } from '@/lib/chain/client';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { DONATION_WALLET } from '@/lib/db/plan';
import { isValidAddress } from '@/lib/utils';

const MIN_DONATION = parseEther('1'); // 1 MON minimum

export async function POST(request: NextRequest) {
  const { limited, retryAfterMs } = rateLimit('verify-donation', getClientIp(request), { windowMs: 60_000, maxRequests: 5 });
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const { txHash, walletAddress } = await request.json();

    if (!txHash || !walletAddress) {
      return NextResponse.json(
        { error: 'Transaction hash and wallet address are required' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { error: 'Invalid transaction hash format' },
        { status: 400 }
      );
    }

    if (!isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const client = createServerClient();

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
