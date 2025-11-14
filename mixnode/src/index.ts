import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 9000;
const UPSTREAM_RPC_URL = process.env.UPSTREAM_RPC_URL || 'https://polkadot.api.onfinality.io/public';

app.use(express.json());

// CORS middleware for browser requests
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'mixnode',
  });
});

// JSON-RPC proxy endpoint
app.post('/rpc', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Validate JSON-RPC request
    if (Array.isArray(body)) {
      // Batch request - validate each item has jsonrpc and method
      for (const item of body) {
        if (!item.jsonrpc || !item.method) {
          return res.status(400).json({
            error: 'Invalid JSON-RPC batch request',
            message: 'Each item must have jsonrpc and method fields',
          });
        }
      }
    } else {
      // Single request - validate jsonrpc and method
      if (!body.jsonrpc || !body.method) {
        return res.status(400).json({
          error: 'Invalid JSON-RPC request',
          message: 'Request must have jsonrpc and method fields',
        });
      }

      // Log method name (privacy-aware, no params or request details)
      console.log(`[RPC] Method: ${body.method}`);
    }

    // Forward to upstream RPC
    let response: Response;
    try {
      response = await fetch(UPSTREAM_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (fetchError) {
      console.error('[RPC] Fetch error:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      return res.status(502).json({
        error: 'Upstream RPC error',
        details: errorMessage,
      });
    }

    const responseData = await response.json();

    // Forward upstream status and response
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('[RPC] Processing error:', error);
    res.status(502).json({
      error: 'Upstream RPC error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Handle OPTIONS for CORS preflight
app.options('/rpc', (_req: Request, res: Response) => {
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`[MIXNODE] Service listening on port ${PORT}`);
  console.log(`[MIXNODE] Using upstream RPC: ${UPSTREAM_RPC_URL}`);
});