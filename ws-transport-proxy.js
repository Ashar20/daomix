#!/usr/bin/env node

/**
 * WebSocket to Transport Mix Proxy
 * 
 * Accepts WebSocket connections from browsers and routes JSON-RPC traffic
 * through the transport mix network (entry → middle → exit → parachain).
 * 
 * NO MOCKS - Real onion routing for every RPC request.
 */

const WebSocket = require('ws');
const axios = require('axios');

// Configuration
const WS_PORT = process.env.WS_PROXY_PORT || 9950;
const ENTRY_NODE_URL = process.env.TRANSPORT_ENTRY_URL || 'http://127.0.0.1:9100';
const TARGET_RPC_URL = process.env.TARGET_RPC_URL || 'http://127.0.0.1:9933';
const CHAIN_NAME = process.env.CHAIN_NAME || 'Chain';

// Create WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`🌐 WS-to-Transport Proxy for ${CHAIN_NAME}`);
console.log(`   Listening: ws://127.0.0.1:${WS_PORT}`);
console.log(`   Entry node: ${ENTRY_NODE_URL}`);
console.log(`   Target RPC: ${TARGET_RPC_URL}`);
console.log(`   🔐 All traffic routed through transport mix (3-hop onion)`);

wss.on('connection', (ws) => {
  console.log(`[${CHAIN_NAME}] 🔗 Browser connected`);

  ws.on('message', async (data) => {
    try {
      // Parse JSON-RPC request
      const rpcRequest = JSON.parse(data.toString());
      const method = rpcRequest.method || 'unknown';
      const id = rpcRequest.id;

      console.log(`[${CHAIN_NAME}] 📡 ${method} (id: ${id})`);

      // Route through transport mix
      const response = await axios.post(
        `${ENTRY_NODE_URL}/rpc-mix`,
        {
          rpcUrl: TARGET_RPC_URL,
          rpcBody: rpcRequest,
          // Transport nodes will handle onion routing internally
        },
        {
          timeout: 60_000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Send response back via WebSocket
      ws.send(JSON.stringify(response.data));

      console.log(`[${CHAIN_NAME}] ✅ ${method} → response sent`);
    } catch (error) {
      console.error(`[${CHAIN_NAME}] ❌ Error:`, error.message);

      // Send error response
      try {
        const rpcRequest = JSON.parse(data.toString());
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: rpcRequest.id,
          error: {
            code: -32603,
            message: `Transport mix error: ${error.message}`,
          },
        }));
      } catch (parseError) {
        console.error(`[${CHAIN_NAME}] Failed to parse request for error response`);
      }
    }
  });

  ws.on('close', () => {
    console.log(`[${CHAIN_NAME}] 🔌 Browser disconnected`);
  });

  ws.on('error', (error) => {
    console.error(`[${CHAIN_NAME}] WebSocket error:`, error.message);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n🛑 Stopping ${CHAIN_NAME} WS-to-Transport proxy...`);
  wss.close(() => {
    console.log(`✅ ${CHAIN_NAME} proxy stopped`);
    process.exit(0);
  });
});

console.log(`\n💡 Browser can connect to: ws://127.0.0.1:${WS_PORT}`);
console.log(`   All RPC traffic will route through transport mix\n`);

