/**
 * WebSocket to Transport Mix Proxy (Hybrid Mode)
 * 
 * Accepts WebSocket connections from browsers with intelligent routing:
 * - Subscriptions (chain_subscribe*, state_subscribe*): Direct WebSocket (fast, no privacy needed)
 * - Transactions (author_submit*, system_*): Transport mix (3-hop onion for privacy)
 * 
 * This balances performance and privacy:
 * - Reading chain state doesn't expose identity → direct connection
 * - Submitting transactions exposes user → transport mix protection
 */

import WebSocket from 'ws';
import { sendRpcOverTransportMix } from './transportClient';
import type { TransportNode } from './transportClient';
import { initCrypto, generateKeypair, toHex } from './crypto';
import axios from 'axios';

interface ProxyConfig {
  wsPort: number;
  chainName: string;
  entryNodeUrl: string;
  targetRpcUrl: string;       // HTTP RPC (e.g., http://127.0.0.1:9933)
  targetWsUrl: string;         // WebSocket RPC (e.g., ws://127.0.0.1:9944)
  transportNodes: TransportNode[];
}

// Methods that should use transport mix for privacy
const PRIVACY_METHODS = [
  'author_submitExtrinsic',
  'author_submitAndWatchExtrinsic',
  'system_accountNextIndex',
];

// Check if method needs privacy (transport mix)
function needsPrivacy(method: string): boolean {
  return PRIVACY_METHODS.some(pm => method.startsWith(pm));
}

export async function startWsTransportProxy(config: ProxyConfig): Promise<void> {
  await initCrypto();

  const wss = new WebSocket.Server({ port: config.wsPort });

  console.log(`🌐 Hybrid WS Proxy for ${config.chainName}`);
  console.log(`   Listening: ws://127.0.0.1:${config.wsPort}`);
  console.log(`   📖 Subscriptions/Queries: Direct WS to ${config.targetWsUrl}`);
  console.log(`   🔐 Transactions: Transport mix via ${config.entryNodeUrl}`);
  console.log(`   Transport nodes: ${config.transportNodes.length} hops\n`);

  wss.on('connection', (clientWs) => {
    console.log(`[${config.chainName}] 🔗 Browser connected`);

    // Create persistent WebSocket connection to parachain for subscriptions
    const parachainWs = new WebSocket(config.targetWsUrl);
    let parachainReady = false;
    const pendingMessages: WebSocket.Data[] = [];

    parachainWs.on('open', () => {
      parachainReady = true;
      console.log(`[${config.chainName}] ✅ Connected to parachain WebSocket`);
      
      // Send any messages that were queued while connecting
      while (pendingMessages.length > 0) {
        const msg = pendingMessages.shift();
        if (msg) {
          parachainWs.send(msg);
        }
      }
    });

    parachainWs.on('error', (error) => {
      console.error(`[${config.chainName}] Parachain WS error:`, error.message);
      clientWs.close();
    });

    parachainWs.on('close', () => {
      console.log(`[${config.chainName}] Parachain WS closed`);
      clientWs.close();
    });

    // Forward messages from parachain to browser
    parachainWs.on('message', (data: WebSocket.Data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        // Convert data to string if it's a Buffer/Blob
        const message = data.toString();
        clientWs.send(message);
      }
    });

    // Handle messages from browser
    clientWs.on('message', async (data: WebSocket.Data) => {
      try {
        const rpcRequest = JSON.parse(data.toString());
        const method = rpcRequest.method || 'unknown';
        const id = rpcRequest.id;
        const params = rpcRequest.params || [];

        // Decide routing strategy
        if (needsPrivacy(method)) {
          // Route through transport mix for privacy
          console.log(`[${config.chainName}] 🔐 ${method} → via transport mix`);

          const senderKeypair = generateKeypair();

          try {
            const response = await sendRpcOverTransportMix({
              entryNodeUrl: config.entryNodeUrl,
              rpcUrl: config.targetRpcUrl,
              method,
              params,
              transportNodes: config.transportNodes,
              senderSecretKeyHex: toHex(senderKeypair.secretKey),
            });

            // Build proper JSON-RPC response
            clientWs.send(JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: response,
            }));

            console.log(`[${config.chainName}] ✅ ${method} → sent via 3-hop mix`);
          } catch (error) {
            console.error(`[${config.chainName}] ❌ Transport mix error:`, (error as Error).message);
            clientWs.send(JSON.stringify({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32603,
                message: `Transport mix error: ${(error as Error).message}`,
              },
            }));
          }
        } else {
          // Route directly via WebSocket for subscriptions/queries
          console.log(`[${config.chainName}] 📖 ${method} → direct WS`);

          if (!parachainReady) {
            // Queue message until parachain WS is ready
            console.log(`[${config.chainName}] ⏳ Queueing ${method} until parachain ready`);
            pendingMessages.push(data);
            return;
          }

          // Forward to parachain WebSocket
          parachainWs.send(data);
        }
      } catch (error) {
        console.error(`[${config.chainName}] ❌ Error:`, (error as Error).message);
      }
    });

    clientWs.on('close', () => {
      console.log(`[${config.chainName}] 🔌 Browser disconnected`);
      parachainWs.close();
    });

    clientWs.on('error', (error) => {
      console.error(`[${config.chainName}] Client WS error:`, error.message);
    });
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(`\n🛑 Stopping ${config.chainName} hybrid proxy...`);
    wss.close(() => {
      console.log(`✅ ${config.chainName} proxy stopped`);
      process.exit(0);
    });
  });

  console.log(`💡 Browser connects to: ws://127.0.0.1:${config.wsPort}`);
  console.log(`   → Subscriptions: Direct to parachain (fast)`);
  console.log(`   → Transactions: 3-hop mix (private)\n`);
}

