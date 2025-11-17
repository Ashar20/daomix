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
// Only non-subscription methods that are request/response
const PRIVACY_METHODS = [
  'author_submitExtrinsic',  // One-shot transaction submission (no watching)
];

// Subscription methods that need privacy but can't use HTTP transport mix
// These get converted to their non-subscription equivalents
const SUBSCRIPTION_PRIVACY_METHODS = [
  'author_submitAndWatchExtrinsic',  // Convert to author_submitExtrinsic
];

// Check if method needs privacy via transport mix (one-shot only)
function needsPrivacy(method: string): boolean {
  return PRIVACY_METHODS.some(pm => method === pm);
}

// Check if this is a subscription method that needs conversion
function needsSubscriptionConversion(method: string): boolean {
  return SUBSCRIPTION_PRIVACY_METHODS.some(pm => method === pm);
}

export async function startWsTransportProxy(config: ProxyConfig): Promise<void> {
  await initCrypto();

  const wss = new WebSocket.Server({ port: config.wsPort });

  console.log(`🌐 Hybrid WS Proxy for ${config.chainName}`);
  console.log(`   Listening: ws://127.0.0.1:${config.wsPort}`);
  console.log(`   📖 Queries/Subscriptions: Direct WS to ${config.targetWsUrl}`);
  console.log(`   🔐 Transactions: Transport mix via ${config.entryNodeUrl}`);
  console.log(`   Transport nodes: ${config.transportNodes.length} hops (entry → middle → exit)\n`);

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
        let method = rpcRequest.method || 'unknown';
        const id = rpcRequest.id;
        let params = rpcRequest.params || [];

        // Convert subscription methods to one-shot for transport mix
        if (needsSubscriptionConversion(method)) {
          console.log(`[${config.chainName}] 🔄 Converting ${method} to one-shot version`);
          
          // author_submitAndWatchExtrinsic -> author_submitExtrinsic
          if (method === 'author_submitAndWatchExtrinsic') {
            method = 'author_submitExtrinsic';
            // Keep first param (the extrinsic), drop callback
            params = [params[0]];
          }
        }

        // Decide routing strategy
        if (needsPrivacy(method)) {
          // Route through transport mix for privacy
          console.log(`[${config.chainName}] 🔐 ${method} → via transport mix`);

          const senderKeypair = generateKeypair();

          console.log(`[${config.chainName}] 🚀 Calling sendRpcOverTransportMix with:`);
          console.log(`[${config.chainName}]    entryNodeUrl: ${config.entryNodeUrl}`);
          console.log(`[${config.chainName}]    targetRpcUrl: ${config.targetRpcUrl}`);
          console.log(`[${config.chainName}]    method: ${method}`);
          console.log(`[${config.chainName}]    transportNodes: ${config.transportNodes.length} hops`);

          const extractRpcResult = (response: unknown) => {
            if (response && typeof response === 'object') {
              const rpcResponse = response as {
                result?: unknown;
                error?: { code?: number; message?: string };
              };

              if (rpcResponse.error) {
                const code = rpcResponse.error.code ?? -32603;
                const message =
                  rpcResponse.error.message ?? 'Unknown transport RPC error';
                throw new Error(`RPC error ${code}: ${message}`);
              }

              if (rpcResponse.result !== undefined) {
                return rpcResponse.result;
              }
            }

            return response;
          };

          try {
            const transportResponse = await sendRpcOverTransportMix({
              entryNodeUrl: config.entryNodeUrl,
              rpcUrl: config.targetRpcUrl,
              method,
              params,
              id,
              transportNodes: config.transportNodes,
              senderSecretKeyHex: toHex(senderKeypair.secretKey),
            });

            console.log(
              `[${config.chainName}] 📨 Got raw response from transport mix:`,
              transportResponse,
            );

            const resultPayload = extractRpcResult(transportResponse);

            // For converted subscription methods, simulate subscription responses
            if (needsSubscriptionConversion(rpcRequest.method)) {
              // Send initial subscription confirmation
              // Use string format for subscription ID (as per JSON-RPC 2.0 spec)
              const subscriptionId = `0x${Math.floor(Math.random() * 1000000).toString(16)}`;
              clientWs.send(JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: subscriptionId,
              }));

              // Send transaction status updates (simulating what subscription would send)
              // The response from transport mix is the transaction hash
              const txHash = resultPayload;

              // Helper to send updates only if WebSocket is still open
              const sendUpdate = (status: any, delay: number) => {
                setTimeout(() => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                      jsonrpc: '2.0',
                      method: 'author_extrinsicUpdate',
                      params: {
                        subscription: subscriptionId,
                        result: status,
                      },
                    }));
                  }
                }, delay);
              };

              // Simulate transaction lifecycle
              // Note: InBlock and Finalized are tuples (BlockHash, TxIndex) in Substrate
              // but we simplify by using just the hash since we don't track the actual block

              // 1. Ready status (transaction is in the ready queue)
              sendUpdate('ready', 100);

              // 2. Broadcast status (transaction broadcasted to peers)
              sendUpdate({ broadcast: [] }, 500);

              // 3. InBlock status (transaction included in a block)
              // Format: { inBlock: [blockHash, txIndex] }
              sendUpdate({ inBlock: [txHash, 0] }, 2000);

              // 4. Finalized status (block is finalized)
              // Format: { finalized: [blockHash, txIndex] }
              sendUpdate({ finalized: [txHash, 0] }, 4000);

              console.log(
                `[${config.chainName}] ✅ ${rpcRequest.method} → submitted via 3-hop mix (subscription emulated)`,
              );
            } else {
              // Build proper JSON-RPC response for non-subscription methods
              clientWs.send(JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: resultPayload,
              }));

              console.log(`[${config.chainName}] ✅ ${method} → sent via 3-hop mix`);
            }
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
  console.log(`   → Queries: Direct (fast)`);
  console.log(`   → Transactions: 3-hop onion routing (private)\n`);
}

