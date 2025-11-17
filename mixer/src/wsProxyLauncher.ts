/**
 * WS Proxy Launcher for Demo
 * 
 * Starts TWO WebSocket proxies:
 * - DaoChain proxy (9950) → Transport Mix → DaoChain (9933)
 * - VotingChain proxy (9951) → Transport Mix → VotingChain (9934)
 * 
 * Both use the SAME transport mix network (3 hops).
 */

import { startWsTransportProxy } from './wsTransportProxy';
import type { TransportNode } from './transportClient';
import axios from 'axios';

interface TransportNodeInfo {
  url: string;
  publicKey: string;
}

async function fetchTransportNodeKeys(): Promise<TransportNodeInfo[]> {
  const nodeUrls = [
    'http://127.0.0.1:9100', // entry
    'http://127.0.0.1:9101', // middle
    'http://127.0.0.1:9102', // exit
  ];

  const nodes: TransportNodeInfo[] = [];

  for (const url of nodeUrls) {
    try {
      const response = await axios.get(`${url}/health`);
      const publicKey = response.data.publicKey;
      
      if (!publicKey) {
        throw new Error(`No public key in response from ${url}`);
      }

      nodes.push({ url, publicKey });
      console.log(`✅ Fetched key from ${url}: ${publicKey.substring(0, 20)}...`);
    } catch (error) {
      console.error(`❌ Failed to fetch key from ${url}:`, (error as Error).message);
      throw error;
    }
  }

  return nodes;
}

async function main() {
  console.log('🚀 Starting WS-to-Transport Proxies for Demo\n');

  // Fetch transport node public keys
  console.log('📡 Fetching transport node public keys...\n');
  const transportNodeInfos = await fetchTransportNodeKeys();

  // Build transport nodes array
  const transportNodes: TransportNode[] = transportNodeInfos.map((info) => ({
    url: info.url,
    publicKey: info.publicKey as `0x${string}`,
  }));

  console.log(`\n✅ Transport network ready: ${transportNodes.length} hops\n`);

  // Start DaoChain proxy
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  startWsTransportProxy({
    wsPort: 9950,
    chainName: 'DaoChain',
    entryNodeUrl: 'http://127.0.0.1:9100',
    targetRpcUrl: 'http://127.0.0.1:9933',
    targetWsUrl: 'ws://127.0.0.1:9944',
    transportNodes,
  });

  // Start VotingChain proxy
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  startWsTransportProxy({
    wsPort: 9951,
    chainName: 'VotingChain',
    entryNodeUrl: 'http://127.0.0.1:9100',
    targetRpcUrl: 'http://127.0.0.1:9934',
    targetWsUrl: 'ws://127.0.0.1:9945',
    transportNodes,
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎉 Both proxies running!');
  console.log('\n📋 Browser connection URLs:');
  console.log('   DaoChain:    ws://127.0.0.1:9950');
  console.log('   VotingChain: ws://127.0.0.1:9951');
  console.log('\n🔐 All traffic routes through 3-hop transport mix\n');
  console.log('Press Ctrl+C to stop\n');
}

main().catch((error) => {
  console.error('❌ Failed to start proxies:', error);
  process.exit(1);
});

