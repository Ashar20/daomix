import { sendRpcOverTransportMix } from './src/transportClient';
import { initCrypto, generateKeypair, toHex } from './src/crypto';
import axios from 'axios';

async function test() {
  await initCrypto();
  
  // Fetch transport node keys
  const entry = await axios.get('http://127.0.0.1:9100/health');
  const middle = await axios.get('http://127.0.0.1:9101/health');
  const exit = await axios.get('http://127.0.0.1:9102/health');
  
  console.log('Transport nodes:');
  console.log(`  Entry:  ${entry.data.publicKey}`);
  console.log(`  Middle: ${middle.data.publicKey}`);
  console.log(`  Exit:   ${exit.data.publicKey}`);
  console.log('');
  
  const sender = generateKeypair();
  
  console.log('Sending RPC through 3-hop mix...');
  const response = await sendRpcOverTransportMix({
    entryNodeUrl: 'http://127.0.0.1:9100',
    rpcUrl: 'http://127.0.0.1:9944',
    method: 'system_chain',
    params: [],
    id: 1,
    transportNodes: [
      { url: 'http://127.0.0.1:9100', publicKey: entry.data.publicKey },
      { url: 'http://127.0.0.1:9101', publicKey: middle.data.publicKey },
      { url: 'http://127.0.0.1:9102', publicKey: exit.data.publicKey },
    ],
    senderSecretKeyHex: toHex(sender.secretKey),
  });
  
  console.log('✅ Response:', response);
}

test().catch(console.error);
