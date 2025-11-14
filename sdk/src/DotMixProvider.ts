export interface DotMixProviderConfig {
  mixnodeUrl: string; // e.g. "http://127.0.0.1:9000/rpc"
  polokolChainUrl?: string; // reserved for later
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown[];
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class DotMixProvider {
  private mixnodeUrl: string;
  private polokolChainUrl?: string;

  constructor(config: DotMixProviderConfig) {
    this.mixnodeUrl = config.mixnodeUrl;
    this.polokolChainUrl = config.polokolChainUrl;
  }

  async request(method: string, params: unknown[]): Promise<any> {
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    const response = await fetch(this.mixnodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseJson: any = await response.json();

    // Handle HTTP errors (502 Bad Gateway typically means upstream is down)
    if (!response.ok) {
      // Try to extract error details from JSON response
      if (responseJson && typeof responseJson === 'object' && 'error' in responseJson) {
        const errorDetails = 'details' in responseJson && responseJson.details
          ? `: ${responseJson.details}` 
          : '';
        throw new Error(
          `${responseJson.error}${errorDetails} (HTTP ${response.status})`
        );
      }
      throw new Error(
        `RPC request failed with status ${response.status}: ${response.statusText}`
      );
    }

    // Handle batch response (array)
    if (Array.isArray(responseJson)) {
      return responseJson;
    }

    // Handle single response
    const jsonRpcResponse = responseJson as JsonRpcResponse;

    if (jsonRpcResponse.error) {
      throw new Error(
        `RPC error: ${jsonRpcResponse.error.message} (code: ${jsonRpcResponse.error.code})`
      );
    }

    return jsonRpcResponse.result;
  }

  async send(method: string, params: unknown[]): Promise<any> {
    // Alias to request for backward compatibility
    return this.request(method, params);
  }
}