#!/usr/bin/env node
/**
 * Run this after deploying contracts via Remix:
 *   node scripts/update-addresses.js <STREAM_ADDRESS> <LOCK_ADDRESS>
 *
 * Example:
 *   node scripts/update-addresses.js 0x1234...5678 0xabcd...efgh
 */

const fs = require('fs');
const path = require('path');

const [,, streamAddress, lockAddress] = process.argv;

if (!streamAddress || !lockAddress) {
  console.log('\nUsage: node scripts/update-addresses.js <STREAM_ADDRESS> <LOCK_ADDRESS>\n');
  console.log('Example:');
  console.log('  node scripts/update-addresses.js 0x1234567890abcdef1234567890abcdef12345678 0xabcdef1234567890abcdef1234567890abcdef12\n');
  process.exit(1);
}

// Validate addresses
const addressRegex = /^0x[a-fA-F0-9]{40}$/;
if (!addressRegex.test(streamAddress)) {
  console.error('Invalid stream address format. Must be 0x followed by 40 hex characters.');
  process.exit(1);
}
if (!addressRegex.test(lockAddress)) {
  console.error('Invalid lock address format. Must be 0x followed by 40 hex characters.');
  process.exit(1);
}

console.log('\nUpdating contract addresses...\n');
console.log('TokenStream:', streamAddress);
console.log('TokenLock:', lockAddress);
console.log('');

// Files to update for TokenStream
const streamFiles = [
  'src/app/streams/page.tsx',
  'src/app/streams/create/page.tsx',
  'src/app/streams/[id]/page.tsx',
];

// Update stream files
for (const file of streamFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(
      /const STREAM_CONTRACT_ADDRESS: Address \| null = null;/g,
      `const STREAM_CONTRACT_ADDRESS: Address = '${streamAddress}';`
    );
    fs.writeFileSync(filePath, content);
    console.log('Updated:', file);
  } else {
    console.log('Not found:', file);
  }
}

// Update lock file
const lockFile = path.join(__dirname, '..', 'src/app/lock/page.tsx');
if (fs.existsSync(lockFile)) {
  let content = fs.readFileSync(lockFile, 'utf8');
  content = content.replace(
    /const LOCK_CONTRACT_ADDRESS: Address \| null = null;/g,
    `const LOCK_CONTRACT_ADDRESS: Address = '${lockAddress}';`
  );
  fs.writeFileSync(lockFile, content);
  console.log('Updated: src/app/lock/page.tsx');
} else {
  console.log('Not found: src/app/lock/page.tsx');
}

console.log('\nDone! Restart your dev server to see the changes.');
console.log('\nView contracts on explorer:');
console.log(`  TokenStream: https://monadvision.com/address/${streamAddress}`);
console.log(`  TokenLock: https://monadvision.com/address/${lockAddress}`);
