#!/usr/bin/env ts-node

import { generateKeypair, toHex, initCrypto } from './crypto';
import * as fs from 'fs';
import * as path from 'path';

async function generateKeys() {
  console.log('🔐 Generating onion encryption keys...');

  // Initialize crypto
  await initCrypto();

  // Generate tally keypair
  const tallyKeypair = generateKeypair();
  const tallyKeys = {
    sk: toHex(tallyKeypair.secretKey),
    pk: toHex(tallyKeypair.publicKey)
  };

  // Generate sender keypair
  const senderKeypair = generateKeypair();
  const senderKeys = {
    sk: toHex(senderKeypair.secretKey),
    pk: toHex(senderKeypair.publicKey)
  };

  // Write to files
  const rootDir = path.resolve(__dirname, '..', '..');
  const tallyPath = path.join(rootDir, '.tmp-tally.json');
  const senderPath = path.join(rootDir, '.tmp-sender.json');

  fs.writeFileSync(tallyPath, JSON.stringify(tallyKeys, null, 2));
  fs.writeFileSync(senderPath, JSON.stringify(senderKeys, null, 2));

  console.log(`✅ Generated tally keys: ${tallyPath}`);
  console.log(`✅ Generated sender keys: ${senderPath}`);
  console.log('🎯 Public keys:');
  console.log(`   Tally: ${tallyKeys.pk}`);
  console.log(`   Sender: ${senderKeys.pk}`);
}

// Run if called directly
if (require.main === module) {
  generateKeys().catch(console.error);
}

export { generateKeys };
