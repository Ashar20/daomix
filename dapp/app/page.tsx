'use client';

import { useEffect, useState } from 'react';
import { DotMixProvider } from '@polokol/dotmix-provider';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const DEFAULT_POLKOL_RPC_URL = 'http://127.0.0.1:9296/polkadot/mainnet';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [blockInfo, setBlockInfo] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [latestBlockLabel, setLatestBlockLabel] = useState<string>('');

  useEffect(() => {
    const fetchBlock = async () => {
      setStatus('loading');
      setErrorMessage('');
      setLatestBlockLabel('');

      try {
        const provider = new DotMixProvider({
          mixnodeUrl: DEFAULT_POLKOL_RPC_URL,
        });

        const result = await provider.request('chain_getBlock', []);

        // Extract block number from response
        if (result && result.block && result.block.header) {
          const blockNumber = result.block.header.number;
          if (blockNumber) {
            // Parse hex to decimal for display
            const blockNum = typeof blockNumber === 'string' 
              ? parseInt(blockNumber.replace(/^0x/, ''), 16) 
              : blockNumber;
            setLatestBlockLabel(`#${blockNum.toLocaleString()}`);
          }
        }

        setBlockInfo(JSON.stringify(result, null, 2));
        setStatus('ok');
      } catch (error) {
        let errorMsg = 'Unknown error occurred';
        
        if (error instanceof Error) {
          errorMsg = error.message;
          
          // Handle specific fetch errors
          if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMsg = 'Cannot connect to mixnode. Make sure the mixnode is running on http://127.0.0.1:9000';
          }
        }
        
        setErrorMessage(errorMsg);
        setStatus('error');
        console.error('Error fetching block:', error);
      }
    };

    fetchBlock();
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Polokol SafeDAO Demo</h1>
      <p>
        This dApp will use the Polokol DotMixProvider to route DAO voting
        through a mixer.
      </p>

      <section style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <h2 style={{ marginTop: 0 }}>Polokol → Polkadot Connection</h2>
        <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
          <strong>Status:</strong>{' '}
          <span
            style={{
              color:
                status === 'ok'
                  ? '#22c55e'
                  : status === 'error'
                  ? '#ef4444'
                  : status === 'loading'
                  ? '#3b82f6'
                  : '#6b7280',
              fontWeight: 'bold',
            }}
          >
            {status === 'ok' ? 'Connected' : status}
          </span>
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
          <strong>Polokol cMix proxy URL:</strong>{' '}
          <code style={{ backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '3px', fontSize: '0.875rem' }}>
            {DEFAULT_POLKOL_RPC_URL}
          </code>
        </p>
        {status === 'ok' && latestBlockLabel && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
            <strong>Latest block:</strong>{' '}
            <span style={{ fontFamily: 'monospace', color: '#3b82f6', fontWeight: '600' }}>
              {latestBlockLabel}
            </span>
          </p>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Raw Block Data</h2>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          Full JSON response from <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px' }}>chain_getBlock</code>
        </p>

        {errorMessage && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              marginTop: '1rem',
            }}
          >
            <strong>Error:</strong> {errorMessage}
            {errorMessage.includes('Cannot connect to mixnode') && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fff', borderRadius: '4px' }}>
                <strong>💡 Troubleshooting:</strong>
                <ol style={{ margin: '0.5rem 0 0 1rem', paddingLeft: '1rem', fontSize: '0.875rem' }}>
                  <li>Make sure the Polokol cMix client proxy is running on port 9296.</li>
                  <li>Verify the relay/client stack started correctly by curling <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px' }}>{DEFAULT_POLKOL_RPC_URL}</code>.</li>
                  <li>Refresh this page after the proxy is reachable.</li>
                </ol>
              </div>
            )}
            {errorMessage.includes('Upstream RPC error') && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fff', borderRadius: '4px' }}>
                <strong>💡 This is expected!</strong>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                  The mixnode is working correctly, but no Substrate node is running at the upstream RPC URL.
                  <br />
                  <br />
                  To see live data:
                  <ol style={{ margin: '0.5rem 0 0 1rem', paddingLeft: '1rem' }}>
                    <li>Ensure the mixnode is running with a valid upstream RPC URL</li>
                    <li>Check that the mixnode can reach the upstream endpoint</li>
                  </ol>
                  <br />
                  Default upstream URL: <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px' }}>{DEFAULT_POLKOL_RPC_URL}</code>
                </p>
              </div>
            )}
          </div>
        )}

        {blockInfo && (
          <pre
            style={{
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              overflow: 'auto',
              marginTop: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {blockInfo}
          </pre>
        )}
      </section>
    </main>
  );
}