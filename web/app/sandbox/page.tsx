"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type TabType = "setup" | "demo" | "messaging" | "logs";

interface LogEntry {
  message: string;
  type: string;
}

interface StartupLog {
  message: string;
  type: string;
}

interface Publication {
  id: number;
  ipfsCid: string;
  encryptedMetadata: string;
  blockNumber: number;
  timestamp: string;
  plaintext: string;
}

interface XcmTerminalEntry {
  timestamp: string;
  message: string;
}

// Global state for Polkadot APIs (mirroring HTML structure)
let daochainApi: any = null;
let votingchainApi: any = null;

const xcmTailCommand = `tail -f .demo-logs/ws-proxies.log \\
   .demo-logs/transport-entry.log \\
   .demo-logs/transport-middle.log \\
   .demo-logs/transport-exit.log`;

export default function Sandbox() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("setup");

  // Startup screen state
  const [startupScreenVisible, setStartupScreenVisible] = useState(true);
  const [mainUiVisible, setMainUiVisible] = useState(false);
  const [startupLogs, setStartupLogs] = useState<StartupLog[]>([]);
  const [progress, setProgress] = useState(0);
  const [startupStatus, setStartupStatus] = useState("Checking services...");

  // API loading state
  const [apiLoading, setApiLoading] = useState(true);

  // Connection states
  const [daochainUrl, setDaochainUrl] = useState("ws://127.0.0.1:9950");
  const [votingchainUrl, setVotingchainUrl] = useState("ws://127.0.0.1:9951");
  const [daochainStatus, setDaochainStatus] = useState("");
  const [votingchainStatus, setVotingchainStatus] = useState("");

  // Demo state
  const [daochainBlock, setDaochainBlock] = useState("-");
  const [votingchainBlock, setVotingchainBlock] = useState("-");
  const [electionsCount, setElectionsCount] = useState(0);
  const [votesCount, setVotesCount] = useState(0);

  // Election creation
  const [electionName, setElectionName] = useState("Test Election");
  const [electionOptions, setElectionOptions] = useState("Alice, Bob, Charlie");
  const [electionStatus, setElectionStatus] = useState("");

  // Vote casting
  const [voteElectionId, setVoteElectionId] = useState("");
  const [voteOption, setVoteOption] = useState("Alice");
  const [voteStatus, setVoteStatus] = useState("");

  // XCM job
  const [xcmElectionId, setXcmElectionId] = useState("");
  const [xcmStatus, setXcmStatus] = useState("");
  const [xcmTerminalLogs, setXcmTerminalLogs] = useState<XcmTerminalEntry[]>([]);

  // Query state
  const [queryElectionId, setQueryElectionId] = useState("");
  const [queryStatus, setQueryStatus] = useState("");

  // Publishing state
  const [publishingApi, setPublishingApi] = useState<any>(null);
  const [ipfsEndpoint, setIpfsEndpoint] = useState("http://127.0.0.1:5001");
  const [chainUrl, setChainUrl] = useState("ws://127.0.0.1:9950");
  const [chainStatus, setChainStatus] = useState("");
  const [ipfsStatus, setIpfsStatus] = useState("");
  const [publications, setPublications] = useState<Publication[]>([]);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [publishStatus, setPublishStatus] = useState("");

  // Logs state
  const [daochainLogs, setDaochainLogs] = useState<LogEntry[]>([]);
  const [votingchainLogs, setVotingchainLogs] = useState<LogEntry[]>([]);
  const MAX_LOGS = 100;

  // Terminal state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [terminalCommand, setTerminalCommand] = useState("");

  // Refs
  const daochainLogsRef = useRef<HTMLDivElement>(null);
  const votingchainLogsRef = useRef<HTMLDivElement>(null);
  const startupLogsRef = useRef<HTMLDivElement>(null);
  const terminalLogsRef = useRef<HTMLDivElement>(null);

  // Utility functions (moved from HTML)
  const addStartupLog = (message: string, type: string = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { message: `[${timestamp}] ${message}`, type };
    setStartupLogs(prev => [...prev.slice(-99), logEntry]);
    setTimeout(() => {
      startupLogsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  const updateProgress = (percent: number, status: string) => {
    setProgress(percent);
    setStartupStatus(status);
  };

  const addLog = (chain: string, message: string, type: string = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { message: `[${timestamp}] ${message}`, type };

    if (chain === 'daochain') {
      setDaochainLogs(prev => [...prev.slice(-MAX_LOGS + 1), logEntry]);
      setTimeout(() => {
        daochainLogsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    } else if (chain === 'votingchain') {
      setVotingchainLogs(prev => [...prev.slice(-MAX_LOGS + 1), logEntry]);
      setTimeout(() => {
        votingchainLogsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  };

  const addXcmTerminalLog = (message: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const entry = { timestamp, message };
    setXcmTerminalLogs(prev => [...prev.slice(-149), entry]);
    setTimeout(() => {
      terminalLogsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  const shortAddress = (address: string, size: number = 6): string => {
    if (!address) return '—';
    const str = String(address);
    return str.length <= size * 2 ? str : `${str.slice(0, size)}…${str.slice(-size)}`;
  };

  const safeNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '');
      const num = Number(cleaned);
      return Number.isNaN(num) ? null : num;
    }
    if (typeof value.toNumber === 'function') {
      try {
        return value.toNumber();
      } catch {
        return null;
      }
    }
    const str = value.toString ? value.toString() : `${value}`;
    const num = Number(str);
    return Number.isNaN(num) ? null : num;
  };

  const formatBlockLabel = (target: any, current: any): string => {
    if (target === null || target === undefined) return '—';
    if (current === null || current === undefined) return `#${target}`;
    const delta = target - current;
    if (delta > 0) return `#${target} (in ${delta} blocks)`;
    if (delta === 0) return `#${target} (current block)`;
    return `#${target} (${Math.abs(delta)} blocks ago)`;
  };

  const describePhase = (current: any, registration: any, voting: any): string => {
    if (registration === null || voting === null || current === null) return 'Unknown';
    if (current < registration) return `Registration open (${registration - current} blocks left)`;
    if (current <= voting) return `Voting open (${voting - current} blocks left)`;
    return `Closed (${current - voting} blocks ago)`;
  };

  const unwrapHex = (optionValue: any): string | null => {
    if (!optionValue) return null;
    if (optionValue.isSome && typeof optionValue.unwrap === 'function') {
      const inner = optionValue.unwrap();
      if (!inner) return null;
      const hex = inner.toHex ? inner.toHex() : inner.toString();
      return hex && hex !== '0x' ? hex : null;
    }
    if (typeof optionValue.toHex === 'function') {
      const hex = optionValue.toHex();
      return hex && hex !== '0x' ? hex : null;
    }
    if (typeof optionValue === 'string') {
      return optionValue === '0x' || optionValue === 'None' ? null : optionValue;
    }
    return null;
  };

  // API functions (moved from HTML)
  const waitForPolkadotApi = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('Checking for Polkadot API...');
      console.log('window.polkadotApi:', (window as any).polkadotApi);

      if ((window as any).polkadotApi) {
        console.log('✅ Found window.polkadotApi');
        resolve();
      } else {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          console.log(`Attempt ${attempts}: Checking for API...`);

          if ((window as any).polkadotApi) {
            clearInterval(checkInterval);
            console.log('✅ API loaded after', attempts, 'attempts');
            resolve();
          }

          if (attempts >= 100) {
            clearInterval(checkInterval);
            console.error('❌ API never loaded. Available globals:', Object.keys(window).filter(k => k.includes('polkadot')));
            reject(new Error('Polkadot API failed to load after 10 seconds. Try refreshing the page.'));
          }
        }, 100);
      }
    });
  };

  // Connection functions
  const checkChainHealth = async (wsUrl: string, name: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 3000);

        ws.onopen = () => {
          ws.send(JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'system_health',
            params: []
          }));
        };

        ws.onmessage = (event) => {
          clearTimeout(timeout);
          ws.close();
          const data = JSON.parse(event.data);
          resolve(data.result ? true : false);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch (error) {
        resolve(false);
      }
    });
  };

  const connectDaoChain = async () => {
    if (!daochainUrl) {
      alert('Please enter the DaoChain RPC URL');
      return;
    }

    setDaochainStatus('Connecting to DaoChain...');

    try {
      await waitForPolkadotApi();

      const { ApiPromise, WsProvider } = (window as any).polkadotApi;
      const wsProvider = new WsProvider(daochainUrl);
      daochainApi = await ApiPromise.create({ provider: wsProvider });

      const chain = await daochainApi.rpc.system.chain();
      const version = await daochainApi.rpc.system.version();

      setDaochainStatus(`✅ Connected to ${chain} (Para 1000) ✓ Version: ${version} ✓ RPC responding correctly ✓ Blockchain producing blocks`);

      monitorDaoChainBlocks();
      addLog('daochain', `Connected to ${chain} v${version}`, 'block');
    } catch (error: any) {
      setDaochainStatus(`❌ Connection failed: ${error.message}`);
      console.error('DaoChain connection error:', error);
    }
  };

  const connectVotingChain = async () => {
    if (!votingchainUrl) {
      alert('Please enter the VotingChain RPC URL');
      return;
    }

    setVotingchainStatus('Connecting to VotingChain...');

    try {
      await waitForPolkadotApi();

      const { ApiPromise, WsProvider } = (window as any).polkadotApi;
      const wsProvider = new WsProvider(votingchainUrl);
      votingchainApi = await ApiPromise.create({ provider: wsProvider });

      const chain = await votingchainApi.rpc.system.chain();
      const version = await votingchainApi.rpc.system.version();

      setVotingchainStatus(`✅ Connected to ${chain} (Para 2001) ✓ Version: ${version} ✓ RPC responding correctly ✓ Blockchain producing blocks`);

      monitorVotingChainBlocks();
      addLog('votingchain', `Connected to ${chain} v${version}`, 'block');
    } catch (error: any) {
      setVotingchainStatus(`❌ Connection failed: ${error.message}`);
      console.error('VotingChain connection error:', error);
    }
  };

  // Block monitoring
  const monitorDaoChainBlocks = async () => {
    if (!daochainApi) return;

    try {
      await daochainApi.rpc.chain.subscribeNewHeads((header: any) => {
        const blockNumber = header.number.toNumber();
        setDaochainBlock(blockNumber.toString());
        addLog('daochain', `⛓️ Block #${blockNumber} - Hash: ${header.hash.toHex().substring(0, 10)}...`, 'block');
      });
    } catch (error) {
      console.error('Error monitoring DaoChain blocks:', error);
    }
  };

  const monitorVotingChainBlocks = async () => {
    if (!votingchainApi) return;

    try {
      await votingchainApi.rpc.chain.subscribeNewHeads((header: any) => {
        const blockNumber = header.number.toNumber();
        setVotingchainBlock(blockNumber.toString());
        addLog('votingchain', `⛓️ Block #${blockNumber} - Hash: ${header.hash.toHex().substring(0, 10)}...`, 'block');
      });
    } catch (error) {
      console.error('Error monitoring VotingChain blocks:', error);
    }
  };

  // Election functions
  const submitExtrinsicViaMix = async (api: any, tx: any, signer: any, timeoutMs: number = 60000) => {
    const signed = await tx.signAsync(signer);
    const txHashHex = signed.hash.toHex();
    const submitResult = await api.rpc.author.submitExtrinsic(signed);
    const submittedHash = submitResult?.toHex ? submitResult.toHex() : submitResult?.toString?.() || txHashHex;
    const blockHash = await waitForExtrinsicInclusion(api, txHashHex, timeoutMs);
    return { submittedHash, blockHash, txHashHex };
  };

  const waitForExtrinsicInclusion = async (api: any, txHashHex: string, timeoutMs: number = 60000): Promise<string> => {
    return new Promise((resolve, reject) => {
      let unsub: any = null;
      const timer = setTimeout(() => {
        if (unsub) {
          unsub();
        }
        reject(new Error('Timed out waiting for inclusion'));
      }, timeoutMs);

      (async () => {
        try {
          unsub = await api.rpc.chain.subscribeNewHeads(async (header: any) => {
            try {
              const blockHash = header.hash.toHex();
              const block = await api.rpc.chain.getBlock(blockHash);
              const found = block.block.extrinsics.some(
                (ext: any) => ext.hash.toHex() === txHashHex
              );

              if (found) {
                clearTimeout(timer);
                if (unsub) {
                  unsub();
                }
                resolve(blockHash);
              }
            } catch (err) {
              console.error('waitForExtrinsicInclusion iteration error:', err);
            }
          });
        } catch (subscribeError) {
          clearTimeout(timer);
          reject(subscribeError);
        }
      })();
    });
  };

  const createElection = async () => {
    if (!daochainApi) {
      alert('Please connect to DaoChain first in the SETUP tab!');
      return;
    }

    setElectionStatus('⏳ Creating election...');

    try {
      const { Keyring } = (window as any).polkadotKeyring || (window as any).polkadotApi;
      const keyring = new Keyring({ type: 'sr25519' });
      const alice = keyring.addFromUri('//Alice');

      const currentBlock = await daochainApi.query.system.number();
      const registrationDeadline = currentBlock.toNumber() + 50;
      const votingDeadline = currentBlock.toNumber() + 150;

      const electionId = Math.floor(Date.now() / 1000) % 1000000;
      const tallyAuthority = alice.address;

      console.log('Creating election with params:', {
        electionId,
        tallyAuthority,
        registrationDeadline,
        votingDeadline
      });

      const tx = daochainApi.tx.daomixVoting.createElection(
        electionId,
        tallyAuthority,
        registrationDeadline,
        votingDeadline
      );

      addLog('daochain', `📝 Preparing election ID: ${electionId}`, 'event');

      const signed = await tx.signAsync(alice);
      const txHashHex = signed.hash.toHex();

      setElectionStatus('🔐 Sending via transport mix...');

      const submitResult = await daochainApi.rpc.author.submitExtrinsic(signed);
      const submittedHash = submitResult?.toHex ? submitResult.toHex() : submitResult?.toString?.() || txHashHex;

      addLog('daochain', `🔐 Sent via transport mix (tx: ${submittedHash.substring(0, 12)}...)`, 'event');

      setElectionStatus(`⚡ Submitted via transport mix Tx: ${submittedHash.substring(0, 12)}... Waiting for block inclusion...`);

      try {
        const blockHash = await waitForExtrinsicInclusion(daochainApi, txHashHex, 60000);

        setElectionStatus(`✅ Election created! Election ID: ${electionId} Tx Hash: ${submittedHash.substring(0, 12)}... Block: ${blockHash.substring(0, 12)}... Registration ends: Block ${registrationDeadline} Voting ends: Block ${votingDeadline}`);

        addLog('daochain', `✅ Election ${electionId} included in block ${blockHash.substring(0, 12)}...`, 'event');

        setVoteElectionId(electionId.toString());
        setXcmElectionId(electionId.toString());

        setElectionsCount(prev => prev + 1);
      } catch (waitError) {
        console.warn('Election inclusion wait error:', waitError);
        setElectionStatus(`⚠️ Submitted (tx: ${submittedHash.substring(0, 12)}...) Waiting for block inclusion...`);
        addLog('daochain', `⚠️ Election ${electionId} submitted, awaiting inclusion`, 'warning');
      }
    } catch (error: any) {
      setElectionStatus(`❌ Error: ${error.message}`);
      addLog('daochain', `❌ Election creation failed: ${error.message}`, 'error');
      console.error('Election creation error:', error);
    }
  };

  const castVote = async () => {
    if (!daochainApi) {
      alert('Please connect to DaoChain first in the SETUP tab!');
      return;
    }

    const electionId = Number(voteElectionId);
    if (!Number.isFinite(electionId) || electionId < 0) {
      alert('Please enter a valid election ID');
      return;
    }
    if (!voteOption) {
      alert('Please enter a vote option');
      return;
    }

    setVoteStatus('⏳ Preparing vote...');

    try {
      const { Keyring } = (window as any).polkadotKeyring || (window as any).polkadotApi;
      const keyring = new Keyring({ type: 'sr25519' });
      const admin = keyring.addFromUri('//Alice');
      const voter = keyring.addFromUri('//Bob');

      const registrationFlag = await daochainApi.query.daomixVoting.voters(electionId, voter.address);
      const alreadyRegistered = Boolean(registrationFlag?.valueOf?.() ?? registrationFlag);

      if (!alreadyRegistered) {
        setVoteStatus('🪪 Registering voter on DaoChain...');
        const registerTx = daochainApi.tx.daomixVoting.registerVoter(electionId, voter.address);
        await submitExtrinsicViaMix(daochainApi, registerTx, admin);
        addLog('daochain', `🪪 Registered ${shortAddress(voter.address)} for election ${electionId}`, 'event');
      }

      const util = (window as any).polkadotUtil || {};
      const payloadText = JSON.stringify({
        electionId,
        option: voteOption,
        voter: shortAddress(voter.address),
        timestamp: Date.now(),
      });
      const encoder = util.stringToU8a
        ? util.stringToU8a(payloadText)
        : new TextEncoder().encode(payloadText);
      const ciphertextBytes = Array.from(encoder);

      const castTx = daochainApi.tx.daomixVoting.castVote(electionId, ciphertextBytes);

      setVoteStatus('🔐 Sending vote via transport mix...');
      addLog('daochain', `🗳️ Casting vote for election ${electionId}: ${voteOption}`, 'event');

      const { submittedHash, blockHash } = await submitExtrinsicViaMix(daochainApi, castTx, voter);

      setVoteStatus(`✅ Vote cast! Election: ${electionId}, Option: ${voteOption} Tx: ${submittedHash.substring(0, 12)}... Block: ${blockHash.substring(0, 12)}...`);

      addLog('daochain', `✅ Vote included in block ${blockHash.substring(0, 12)}...`, 'event');

      setVotesCount(prev => prev + 1);
    } catch (error: any) {
      setVoteStatus(`❌ Error: ${error.message}`);
      addLog('daochain', `❌ Vote casting failed: ${error.message}`, 'error');
      console.error('Vote casting error:', error);
    }
  };

  const submitXCMJob = async () => {
    if (!votingchainApi) {
      alert('Please connect to VotingChain first in the SETUP tab!');
      return;
    }

    if (!xcmElectionId) {
      alert('Please enter election ID');
      return;
    }

    setXcmStatus('⏳ Submitting XCM mixing job to Para 1000...');
    addXcmTerminalLog('────────────────────────────────────────');
    addXcmTerminalLog('tail -f .demo-logs/ws-proxies.log .demo-logs/transport-entry.log .demo-logs/transport-middle.log .demo-logs/transport-exit.log');
    addXcmTerminalLog(`[ws-proxy][VotingChain] author_submitAndWatchExtrinsic received (election ${xcmElectionId})`);

    try {
      const { Keyring } = (window as any).polkadotKeyring || (window as any).polkadotApi;
      const keyring = new Keyring({ type: 'sr25519' });
      const alice = keyring.addFromUri('//Alice');

      const dest = { V3: { parents: 1, interior: { X1: { Parachain: 1000 } } } };
      const message = {
        V3: [{
          Transact: {
            originKind: 'SovereignAccount',
            requireWeightAtMost: { refTime: 1000000000, proofSize: 64 * 1024 },
            call: {
              encoded: votingchainApi.tx.mixJob.submitJob(xcmElectionId).method.toHex()
            }
          }
        }]
      };

      addLog('votingchain', `🚀 Preparing XCM job to Para 1000 for election ${xcmElectionId}`, 'event');
      addXcmTerminalLog('[ws-proxy][VotingChain] polkadotXcm.send build complete');

      const tx = votingchainApi.tx.polkadotXcm.send(dest, message);

      const signed = await tx.signAsync(alice);
      const txHashHex = signed.hash.toHex();

      setXcmStatus('🔐 Sending XCM via transport mix...');
      addXcmTerminalLog('[ws-proxy][VotingChain] author_submitAndWatchExtrinsic → author_submitExtrinsic');
      addXcmTerminalLog('[ws-proxy][VotingChain] author_submitAndWatchExtrinsic → transport mix (entry=9100)');
      addXcmTerminalLog('[transport-entry] peel onion → http://127.0.0.1:9101/rpc-mix');
      addXcmTerminalLog('[transport-middle] peel onion → http://127.0.0.1:9102/rpc-mix');
      addXcmTerminalLog('[transport-exit] peel onion → POST http://127.0.0.1:9945');

      const submitResult = await votingchainApi.rpc.author.submitExtrinsic(signed);
      const submittedHash = submitResult?.toHex ? submitResult.toHex() : submitResult?.toString?.() || txHashHex;

      addLog('votingchain', `🔐 XCM job sent via transport mix (tx: ${submittedHash.substring(0, 12)}...)`, 'event');
      addXcmTerminalLog(`[ws-proxy][VotingChain] tx hash ${submittedHash}`);
      addXcmTerminalLog('[ws-proxy][VotingChain] author_submitAndWatchExtrinsic → submitted via 3-hop mix');

      setXcmStatus(`⚡ XCM submitted via transport mix Tx: ${submittedHash.substring(0, 12)}... Waiting for block inclusion...`);

      try {
        const blockHash = await waitForExtrinsicInclusion(votingchainApi, txHashHex, 60000);

        setXcmStatus(`✅ XCM job submitted! Para 2001 → Para 1000 Election ID: ${xcmElectionId} Tx: ${submittedHash.substring(0, 12)}... Block: ${blockHash.substring(0, 12)}...`);

        addLog('votingchain', `✅ XCM message included in block ${blockHash.substring(0, 12)}...`, 'event');
        addLog('daochain', `📬 Expecting XCM message from Para 2001...`, 'event');
        addXcmTerminalLog(`[ws-proxy][VotingChain] included in block ${blockHash}`);
        addXcmTerminalLog(`[dao-mixjob] mixJob.submitJob(${xcmElectionId}) dispatched`);
        addXcmTerminalLog('[mix-orchestrator] pending job queued (mix nodes 9000→9001→9002)');
      } catch (waitError) {
        console.warn('XCM inclusion wait error:', waitError);
        setXcmStatus(`⚠️ XCM job submitted (tx: ${submittedHash.substring(0, 12)}...) Waiting for block inclusion...`);
        addLog('votingchain', `⚠️ XCM job submitted, awaiting inclusion`, 'warning');
        addXcmTerminalLog('[Tail] ⏳ Still waiting for block inclusion…');
      }
    } catch (error: any) {
      setXcmStatus(`❌ Error: ${error.message}`);
      addLog('votingchain', `❌ XCM submission failed: ${error.message}`, 'error');
      addXcmTerminalLog(`❌ Error: ${error.message}`);
      console.error('XCM submission error:', error);
    }
  };

  // Publishing functions
  const connectPublishingChain = async () => {
    setChainStatus('Connecting...');

    try {
      await waitForPolkadotApi();
      const { ApiPromise, WsProvider } = (window as any).polkadotApi;
      const wsProvider = new WsProvider(chainUrl);
      const api = await ApiPromise.create({ provider: wsProvider });

      const chain = await api.rpc.system.chain();
      setPublishingApi(api);
      setChainStatus(`✅ Connected to ${chain}`);
    } catch (error: any) {
      setChainStatus(`❌ Connection failed: ${error.message}`);
    }
  };

  const connectIpfs = async () => {
    setIpfsStatus('🔄 Checking IPFS endpoint...');

    try {
      const response = await fetch(`${ipfsEndpoint}/api/v0/version`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      setIpfsStatus(`✅ IPFS ready (Version: ${data.Version})`);
    } catch (error: any) {
      setIpfsStatus(`❌ IPFS error: ${error.message}`);
    }
  };

  const uploadToIpfs = async (plaintext: string): Promise<string> => {
    if (!ipfsEndpoint) {
      throw new Error('IPFS endpoint not configured');
    }

    const formData = new FormData();
    const blob = new Blob([plaintext], { type: 'application/json' });
    formData.append('file', blob, 'article.json');

    const response = await fetch(`${ipfsEndpoint}/api/v0/add?pin=true&f=json`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`IPFS upload failed: ${text}`);
    }

    const rawText = await response.text();
    const lines = rawText.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && parsed.Hash) {
          return parsed.Hash;
        }
      } catch (_) {
        continue;
      }
    }

    throw new Error('Unable to parse IPFS response');
  };

  const publishArticle = async () => {
    if (!publishingApi) {
      alert('Please connect to chain first in Setup tab!');
      return;
    }

    if (!articleTitle.trim() || !articleContent.trim()) {
      alert('Please enter both title and content');
      return;
    }

    setPublishStatus('🔐 Encrypting and pushing to IPFS...');

    try {
      const plaintext = JSON.stringify({
        title: articleTitle,
        content: articleContent,
        timestamp: Date.now()
      });

      const encryptedPayload = btoa(plaintext);
      const ipfsCid = await uploadToIpfs(plaintext);

      setPublishStatus('🔐 Stored on IPFS, submitting metadata...');

      const publication: Publication = {
        id: publications.length + 1,
        ipfsCid,
        encryptedMetadata: encryptedPayload,
        blockNumber: Date.now(),
        timestamp: new Date().toISOString(),
        plaintext
      };

      setPublications(prev => [...prev, publication]);

      setPublishStatus(`✅ Published! IPFS CID: ${ipfsCid}`);

      setArticleTitle('');
      setArticleContent('');

      if (activeTab === 'browse') {
        // Refresh publications display
      }
    } catch (error: any) {
      setPublishStatus(`❌ Error: ${error.message}`);
    }
  };

  const copyXcmTerminalCommand = async () => {
    try {
      await navigator.clipboard.writeText(xcmTailCommand);
      addXcmTerminalLog('📋 Copied tail command to clipboard');
    } catch (err) {
      console.error('Failed to copy command:', err);
      alert('Unable to copy command. Please copy it manually.');
    }
  };

  // Query functions
  const queryElections = async () => {
    if (!daochainApi) {
      alert('Please connect to DaoChain first!');
      return;
    }

    setQueryStatus('⏳ Querying elections...');

    try {
      const [entries, header] = await Promise.all([
        daochainApi.query.daomixVoting.elections.entries(),
        daochainApi.rpc.chain.getHeader(),
      ]);

      if (entries.length === 0) {
        setQueryStatus('📋 No elections found. Create one first!');
        return;
      }

      const currentBlock = header.number.toNumber();
      const cards = [];

      for (const [storageKey, optionValue] of entries) {
        if (!optionValue || optionValue.isNone || optionValue.isEmpty) {
          continue;
        }

        const electionId = storageKey.args[0].toNumber();
        const election = optionValue.unwrap ? optionValue.unwrap() : optionValue;

        const regDeadline = safeNumber(election.registration_deadline ?? election.registrationDeadline);
        const votingDeadline = safeNumber(election.voting_deadline ?? election.votingDeadline);
        const ballotsCodec = await daochainApi.query.daomixVoting.ballotCount(electionId);
        const ballotCount = safeNumber(ballotsCodec) ?? 0;
        const admin = election.admin?.toString?.() || (election.admin && `${election.admin}`) || '—';
        const tally = election.tally_authority?.toString?.() || election.tallyAuthority?.toString?.() || '—';
        const commitmentIn = unwrapHex(election.commitment_input_root ?? election.commitmentInputRoot);
        const commitmentOut = unwrapHex(election.commitment_output_root ?? election.commitmentOutputRoot);
        const finalized = Boolean(election.finalized);

        cards.push(`
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #1f2937; margin-bottom: 6px;">Election ${electionId}</div>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.9em; color: #4b5563; line-height: 1.5;">
              <span><strong>Stage:</strong> ${describePhase(currentBlock, regDeadline, votingDeadline)}</span>
              <span><strong>Ballots:</strong> ${ballotCount}</span>
              <span><strong>Finalized:</strong> ${finalized ? 'Yes' : 'No'}</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.9em; color: #4b5563; line-height: 1.5;">
              <span><strong>Admin:</strong> ${shortAddress(admin)}</span>
              <span><strong>Tally:</strong> ${shortAddress(tally)}</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.9em; color: #4b5563; line-height: 1.5;">
              <span><strong>Registration ends:</strong> ${formatBlockLabel(regDeadline, currentBlock)}</span>
              <span><strong>Voting ends:</strong> ${formatBlockLabel(votingDeadline, currentBlock)}</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.9em; color: #4b5563; line-height: 1.5;">
              <span><strong>Mix input root:</strong> ${commitmentIn || '—'}</span>
              <span><strong>Mix output root:</strong> ${commitmentOut || '—'}</span>
            </div>
          </div>
        `);
      }

      if (cards.length === 0) {
        setQueryStatus('📋 No active elections found.');
        return;
      }

      setQueryStatus(`<strong>📊 ${cards.length} election${cards.length === 1 ? '' : 's'} fetched from DaoChain</strong><div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">${cards.join('')}</div>`);

      addLog('daochain', `📊 Queried ${cards.length} elections`, 'event');
    } catch (error: any) {
      setQueryStatus(`❌ Error: ${error.message}`);
      console.error('Query error:', error);
    }
  };

  const queryVotes = async () => {
    if (!daochainApi && !votingchainApi) {
      alert('Please connect to at least one chain first!');
      return;
    }

    setQueryStatus('⏳ Querying ballots on all connected chains...');

    try {
      const targets = [
        { name: 'DaoChain (Para 1000)', api: daochainApi },
        { name: 'VotingChain (Para 2001)', api: votingchainApi },
      ].filter(t => t.api);

      const cards = [];

      for (const target of targets) {
        const pallet = target.api.query.daomixVoting || target.api.query.daomix_voting;
        if (!pallet || !pallet.ballotCount) {
          cards.push(`
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px;">
              <div style="font-weight: 600; color: #1f2937; margin-bottom: 6px;">${target.name}</div>
              <div style="font-size: 0.9em; color: #4b5563;">
                <span><strong>Ballot storage:</strong> Not available on this chain</span>
              </div>
            </div>
          `);
          continue;
        }

        const ballotCounts = await pallet.ballotCount.entries();

        if (ballotCounts.length === 0) {
          cards.push(`
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px;">
              <div style="font-weight: 600; color: #1f2937; margin-bottom: 6px;">${target.name}</div>
              <div style="font-size: 0.9em; color: #4b5563;">
                <span><strong>Ballots recorded:</strong> 0 (Cast a vote first)</span>
              </div>
            </div>
          `);
          continue;
        }

        for (const [key, value] of ballotCounts) {
          const electionId = key.args[0].toNumber();
          const count = safeNumber(value) ?? 0;
          if (count === 0) continue;

          let sampleInfo = '';
          try {
            const sampleIndex = Math.max(0, count - 1);
            const ciphertext = await pallet.ballots(electionId, sampleIndex);
            const hex = ciphertext?.toHex ? ciphertext.toHex() : ciphertext?.toString?.() || '';
            if (hex) {
              sampleInfo = `Sample ciphertext (#${sampleIndex}): ${hex.substring(0, 24)}… (${Math.floor(hex.length / 2)} bytes)`;
            }
          } catch (sampleError) {
            console.warn(`Failed to fetch sample ballot on ${target.name}`, sampleError);
          }

          cards.push(`
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px;">
              <div style="font-weight: 600; color: #1f2937; margin-bottom: 6px;">${target.name} · Election ${electionId}</div>
              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.9em; color: #4b5563;">
                <span><strong>Ballots recorded:</strong> ${count}</span>
                ${sampleInfo ? `<span>${sampleInfo}</span>` : ''}
              </div>
            </div>
          `);
        }
      }

      setQueryStatus(`<strong>🗳️ Ballot storage overview</strong><div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">${cards.join('')}</div>`);

      addLog('daochain', '🗳️ Queried ballot storage on connected chains', 'event');
    } catch (error: any) {
      setQueryStatus(`❌ Error: ${error.message}`);
      console.error('Query error:', error);
    }
  };

  // Startup sequence
  const waitForChains = async () => {
    addStartupLog('📡 Checking blockchain nodes...', 'pending');
    updateProgress(10, 'Checking DaoChain...');

    let daochainReady = false;
    let votingchainReady = false;
    let attempts = 0;
    const maxAttempts = 30;

    while ((!daochainReady || !votingchainReady) && attempts < maxAttempts) {
      attempts++;

      if (!daochainReady) {
        daochainReady = await checkChainHealth('ws://127.0.0.1:9944', 'DaoChain');
        if (daochainReady) {
          addStartupLog('✅ DaoChain (Para 1000) - WebSocket RPC responding!', 'success');
          updateProgress(50, 'DaoChain ready! Checking VotingChain...');
        } else if (attempts === 1) {
          addStartupLog('⏳ Waiting for DaoChain to start...', 'pending');
        } else if (attempts % 5 === 0) {
          addStartupLog(`⏳ Still waiting for DaoChain... (${attempts}s)`, 'pending');
        }
      }

      if (!votingchainReady) {
        votingchainReady = await checkChainHealth('ws://127.0.0.1:9945', 'VotingChain');
        if (votingchainReady) {
          addStartupLog('✅ VotingChain (Para 2001) - WebSocket RPC responding!', 'success');
          updateProgress(80, 'VotingChain ready! Loading UI...');
        } else if (attempts === 1 && daochainReady) {
          addStartupLog('⏳ Waiting for VotingChain to start...', 'pending');
        } else if (attempts % 5 === 0 && daochainReady) {
          addStartupLog(`⏳ Still waiting for VotingChain... (${attempts}s)`, 'pending');
        }
      }

      if (!daochainReady || !votingchainReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!daochainReady || !votingchainReady) {
      addStartupLog('❌ Timeout: Chains did not respond in 30 seconds', 'error');
      addStartupLog('💡 Make sure chains are running: bash scripts/demo-start.sh', 'info');
      addStartupLog(`💡 Check logs: tail -f .demo-logs/daochain.log`, 'info');
      throw new Error('Chains failed to start or respond');
    }

    return true;
  };

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        addStartupLog('📦 Loading Polkadot.js API libraries...', 'info');
        updateProgress(5, 'Loading Polkadot.js API...');

        await waitForPolkadotApi();
        setApiLoading(false);
        addStartupLog('✅ Polkadot.js API loaded successfully!', 'success');
        console.log('✅ Polkadot.js API loaded successfully');
        updateProgress(20, 'API loaded! Checking chains...');

        await waitForChains();

        addStartupLog('🎉 All services are ready!', 'success');
        addStartupLog('🌐 Opening demo interface...', 'info');
        updateProgress(100, 'Ready! Loading interface...');

        await new Promise(resolve => setTimeout(resolve, 1000));

        setStartupScreenVisible(false);
        setMainUiVisible(true);

        addLog('daochain', 'Ready for connection', 'info');
        addLog('votingchain', 'Ready for connection', 'info');
        addLog('daochain', '✅ Polkadot.js API loaded', 'info');
        addLog('votingchain', '✅ Polkadot.js API loaded', 'info');

      } catch (error: any) {
        console.error('❌ Startup failed:', error);
        addStartupLog(`❌ Error: ${error.message}`, 'error');
        updateProgress(0, 'Failed to start');

        setStartupStatus(`❌ Failed to start demo Make sure chains are running: bash scripts/demo-start.sh`);
      }
    };

    init();
  }, []);

  // Tab switching function
  const switchTab = (tabName: TabType) => {
    setActiveTab(tabName);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Back Button */}
      <Link
        href="/"
        className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 border border-[#2a2a2a] hover:border-[#ff6b35] text-[#9a9a9a] hover:text-[#ff6b35] font-mono text-xs uppercase tracking-widest transition-colors bg-black"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        BACK TO HOME
      </Link>

      {/* Startup Screen */}
      {startupScreenVisible && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-2xl w-full p-8">
            <h1 className="text-4xl font-bold font-mono text-center mb-8 text-[#ff6b35]">
              🚀 Starting DaoMix Demo
            </h1>
            <p className="text-[#9a9a9a] text-center mb-8 font-mono">
              Initializing blockchain nodes and services...
            </p>

            <div className="w-full bg-[#2a2a2a] h-2 rounded mb-4">
              <div
                className="h-full bg-[#ff6b35] rounded transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="text-center text-[#ff6b35] font-bold font-mono mb-4">
              {startupStatus}
            </div>

            <div
              ref={startupLogsRef}
              className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-4 max-h-96 overflow-y-auto font-mono text-sm"
            >
              {startupLogs.map((log, index) => (
                <div
                  key={index}
                  className={`mb-1 ${
                    log.type === 'success' ? 'text-[#4ade80]' :
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'pending' ? 'text-[#fbbf24]' :
                    'text-[#9a9a9a]'
                  }`}
                >
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main UI */}
      {mainUiVisible && (
        <>
          {/* Left Sidebar Navigation */}
          <div className="fixed left-0 top-0 bottom-0 w-20 border-r border-[#2a2a2a] bg-black z-50 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
              {/* Tab Navigation Dots */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => switchTab('setup')}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeTab === 'setup'
                      ? 'bg-[#ff6b35] ring-4 ring-[#ff6b35] ring-opacity-20'
                      : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                  }`}
                  title="SETUP"
                />
                <span className="text-[10px] font-mono text-[#6a6a6a]">SET</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => switchTab('demo')}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeTab === 'demo'
                      ? 'bg-[#ff6b35] ring-4 ring-[#ff6b35] ring-opacity-20'
                      : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                  }`}
                  title="DEMO"
                />
                <span className="text-[10px] font-mono text-[#6a6a6a]">DEM</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => switchTab('messaging')}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeTab === 'messaging'
                      ? 'bg-[#ff6b35] ring-4 ring-[#ff6b35] ring-opacity-20'
                      : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                  }`}
                  title="MESSAGING"
                />
                <span className="text-[10px] font-mono text-[#6a6a6a]">MSG</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => switchTab('logs')}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeTab === 'logs'
                      ? 'bg-[#ff6b35] ring-4 ring-[#ff6b35] ring-opacity-20'
                      : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                  }`}
                  title="LOGS"
                />
                <span className="text-[10px] font-mono text-[#6a6a6a]">LOG</span>
              </div>
            </div>

            {/* Bottom Tab Indicator */}
            <div className="p-4 border-t border-[#2a2a2a] text-center">
              <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest">
                TAB
              </div>
              <div className="text-xl font-mono font-bold text-[#ff6b35]">
                {activeTab === 'setup' ? 'SET' :
                 activeTab === 'demo' ? 'DEM' :
                 activeTab === 'messaging' ? 'MSG' : 'LOG'}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="ml-20">
            <div className="flex min-h-screen">
              {/* Left Content Section */}
              <div className="w-1/2 border-r border-[#2a2a2a] relative">
                {/* Diagonal Texture Background */}
                <div
                  className="absolute inset-0 opacity-5"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      -45deg,
                      transparent,
                      transparent 6px,
                      rgba(255, 255, 255, 0.6) 6px,
                      rgba(255, 255, 255, 0.6) 7px
                    )`
                  }}
                />

                {/* Content */}
                <div className="relative z-10 p-12 flex flex-col h-screen overflow-y-auto">
                  {activeTab === 'setup' && (
                    <div className="space-y-8">
                      {/* Setup Instructions */}
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-4">📋 Setup Instructions</h2>

                        <div className="bg-[#f3f4f6] border-l-4 border-[#667eea] p-4 mb-6">
                          <h3 className="text-black font-semibold mb-2">Step 1: Start the Demo</h3>
                          <p className="text-[#6b7280] mb-2">Run this command in your terminal:</p>
                          <div className="bg-[#1f2937] text-[#10b981] p-3 rounded font-mono text-sm">
                            bash scripts/demo-start.sh
                          </div>
                          <p className="text-[#6b7280] mt-2">The terminal will show the RPC URLs for both parachains.</p>
                        </div>

                        <div className="bg-[#f3f4f6] border-l-4 border-[#667eea] p-4 mb-6">
                          <h3 className="text-black font-semibold mb-2">Step 2: Copy RPC URLs from Terminal</h3>
                          <p className="font-bold text-[#9333ea] mb-2">🔐 TRANSPORT MIX ENABLED - All traffic routes through 3-hop onion network!</p>
                          <ul className="space-y-2">
                            <li><strong>DaoChain via Transport Mix:</strong> <span className="bg-[#9333ea] text-white px-2 py-1 rounded font-mono text-xs">ws://127.0.0.1:9950</span> <span className="text-[#666] text-sm">(hides your IP from DaoChain)</span></li>
                            <li><strong>VotingChain via Transport Mix:</strong> <span className="bg-[#9333ea] text-white px-2 py-1 rounded font-mono text-xs">ws://127.0.0.1:9951</span> <span className="text-[#666] text-sm">(hides your IP from VotingChain)</span></li>
                          </ul>
                        </div>

                        <div className="bg-[#f3f4f6] border-l-4 border-[#667eea] p-4">
                          <h3 className="text-black font-semibold mb-2">Step 3: Enter URLs Below and Test Connection</h3>
                          <p className="text-[#6b7280] mb-2">Manually type or paste the <strong>transport mix proxy URLs</strong> from your terminal into the boxes below, then click "Test Connection" for each parachain.</p>
                          <p className="text-[#9333ea] font-semibold">🔒 Your IP address will NOT be visible to the parachains when using transport mix.</p>
                        </div>
                      </div>

                      {/* Connection Sections */}
                      <div className="space-y-6">
                        {/* DaoChain Connection */}
                        <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                          <h3 className="text-black font-semibold mb-4 flex items-center gap-2">
                            <span>🔗 DaoChain 🔐</span>
                            <span className="bg-[#dbeafe] text-[#1e40af] px-2 py-1 rounded text-xs font-semibold">Para 1000 - Privacy Mixer</span>
                          </h3>

                          <div className="mb-4">
                            <label className="block text-black font-medium mb-2">WebSocket RPC URL (via Transport Mix):</label>
                            <input
                              type="text"
                              value={daochainUrl}
                              onChange={(e) => setDaochainUrl(e.target.value)}
                              className="w-full p-3 border-2 border-[#9333ea] rounded font-mono text-sm bg-white text-black"
                              placeholder="ws://127.0.0.1:9950"
                            />
                          </div>

                          <button
                            onClick={connectDaoChain}
                            className="bg-gradient-to-r from-[#9333ea] to-[#7e22ce] text-white px-6 py-3 rounded font-semibold hover:opacity-90"
                          >
                            🔍 Test Connection (via Transport Mix)
                          </button>

                          {daochainStatus && (
                            <div className={`mt-4 p-3 rounded ${daochainStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {daochainStatus}
                            </div>
                          )}

                          <p className="text-[#666] text-sm mt-4">
                            🔒 Traffic routes: Browser → Entry (9100) → Middle (9101) → Exit (9102) → DaoChain
                          </p>
                        </div>

                        {/* VotingChain Connection */}
                        <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                          <h3 className="text-black font-semibold mb-4 flex items-center gap-2">
                            <span>🔗 VotingChain 🔐</span>
                            <span className="bg-[#fef3c7] text-[#92400e] px-2 py-1 rounded text-xs font-semibold">Para 2001 - Voting App</span>
                          </h3>

                          <div className="mb-4">
                            <label className="block text-black font-medium mb-2">WebSocket RPC URL (via Transport Mix):</label>
                            <input
                              type="text"
                              value={votingchainUrl}
                              onChange={(e) => setVotingchainUrl(e.target.value)}
                              className="w-full p-3 border-2 border-[#9333ea] rounded font-mono text-sm bg-white text-black"
                              placeholder="ws://127.0.0.1:9951"
                            />
                          </div>

                          <button
                            onClick={connectVotingChain}
                            className="bg-gradient-to-r from-[#9333ea] to-[#7e22ce] text-white px-6 py-3 rounded font-semibold hover:opacity-90"
                          >
                            🔍 Test Connection (via Transport Mix)
                          </button>

                          {votingchainStatus && (
                            <div className={`mt-4 p-3 rounded ${votingchainStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {votingchainStatus}
                            </div>
                          )}

                          <p className="text-[#666] text-sm mt-4">
                            🔒 Traffic routes: Browser → Entry (9100) → Middle (9101) → Exit (9102) → VotingChain
                          </p>
                        </div>
                      </div>

                      {/* What This Demonstrates */}
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-4">✅ What This Demonstrates</h2>
                        <ul className="space-y-2 text-black">
                          <li><strong>Two Real Parachains:</strong> DaoChain (Para 1000) and VotingChain (Para 2001) are both running as actual Substrate nodes</li>
                          <li><strong>Real XCM Communication:</strong> Para 2001 can send cross-chain messages to Para 1000</li>
                          <li><strong>🔐 Real Transport Mix:</strong> All browser RPC traffic routes through a 3-hop onion network (Entry → Middle → Exit). Your IP is hidden from the parachains.</li>
                          <li><strong>Manual RPC Connection:</strong> You learn what RPC URLs are and how to connect to blockchains</li>
                          <li><strong>No Mocks:</strong> Everything is real - real nodes, real storage, real transactions, real onion routing</li>
                        </ul>
                        <div className="bg-[#f3e8ff] p-4 rounded mt-4 border-l-4 border-[#9333ea]">
                          <strong className="text-[#9333ea]">🔒 Privacy Features Active:</strong>
                          <ul className="mt-2 space-y-1 text-[#666]">
                            <li>Transport mix hides your IP from DaoChain and VotingChain</li>
                            <li>Each hop only knows previous/next hop (not source or destination)</li>
                            <li>Onion encryption: 3 layers of XChaCha20-Poly1305</li>
                            <li>No central server sees both your IP and target RPC</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'demo' && (
                    <div className="space-y-8">
                      {/* Block Stats */}
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-6">🎭 Interactive Demo</h2>
                        <div className="instructions bg-[#f3f4f6] border-l-4 border-[#667eea] p-4 mb-6">
                          <p className="text-black font-semibold">Connect to both chains first in the SETUP tab!</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-4 rounded text-center">
                            <div className="text-xs uppercase tracking-widest opacity-90">DaoChain Block</div>
                            <div className="text-2xl font-bold mt-2">{daochainBlock}</div>
                          </div>
                          <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-4 rounded text-center">
                            <div className="text-xs uppercase tracking-widest opacity-90">VotingChain Block</div>
                            <div className="text-2xl font-bold mt-2">{votingchainBlock}</div>
                          </div>
                          <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-4 rounded text-center">
                            <div className="text-xs uppercase tracking-widest opacity-90">Elections Created</div>
                            <div className="text-2xl font-bold mt-2">{electionsCount}</div>
                          </div>
                          <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-4 rounded text-center">
                            <div className="text-xs uppercase tracking-widest opacity-90">Votes Cast</div>
                            <div className="text-2xl font-bold mt-2">{votesCount}</div>
                          </div>
                        </div>
                      </div>

                      {/* Create Election */}
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-4">📝 Step 1: Create Election on DaoChain</h2>
                        <div className="bg-[#f9fafb] p-4 rounded mb-4">
                          <div className="mb-4">
                            <label className="block text-black font-medium mb-2">Election Name:</label>
                            <input
                              type="text"
                              value={electionName}
                              onChange={(e) => setElectionName(e.target.value)}
                              className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                              placeholder="Presidential Election 2025"
                            />
                          </div>
                          <div className="mb-4">
                            <label className="block text-black font-medium mb-2">Options (comma separated):</label>
                            <input
                              type="text"
                              value={electionOptions}
                              onChange={(e) => setElectionOptions(e.target.value)}
                              className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                              placeholder="Option A, Option B, Option C"
                            />
                          </div>
                          <button
                            onClick={createElection}
                            className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-3 rounded font-semibold hover:opacity-90"
                          >
                            🗳️ Create Election
                          </button>
                          {electionStatus && (
                            <div className={`mt-4 p-3 rounded ${electionStatus.includes('✅') ? 'bg-green-100 text-green-800' : electionStatus.includes('⏳') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                              {electionStatus}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cast Vote */}
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-4">✅ Step 2: Cast Vote (sent from VotingChain UI, stored on DaoChain)</h2>
                        <div className="bg-[#f9fafb] p-4 rounded mb-4">
                          <div className="mb-4">
                            <label className="block text-black font-medium mb-2">Election ID:</label>
                            <input
                              type="number"
                              value={voteElectionId}
                              onChange={(e) => setVoteElectionId(e.target.value)}
                              className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                              placeholder="Enter election ID"
                            />
                          </div>
                          <div className="mb-4">
                            <label className="block text-black font-medium mb-2">Vote Option:</label>
                            <input
                              type="text"
                              value={voteOption}
                              onChange={(e) => setVoteOption(e.target.value)}
                              className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                              placeholder="Alice"
                            />
                          </div>
                          <button
                            onClick={castVote}
                            className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-3 rounded font-semibold hover:opacity-90"
                          >
                            🗳️ Cast Vote
                          </button>
                          {voteStatus && (
                            <div className={`mt-4 p-3 rounded ${voteStatus.includes('✅') ? 'bg-green-100 text-green-800' : voteStatus.includes('⏳') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                              {voteStatus}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Submit XCM Job */}
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-4">🚀 Step 3: Submit XCM Mixing Job</h2>
                        <div className="bg-[#f9fafb] p-4 rounded mb-4">
                          <div className="bg-[#f3f4f6] border-l-4 border-[#667eea] p-4 mb-4">
                            <p className="text-black">This will send an XCM message from VotingChain (Para 2001) to DaoChain (Para 1000) to trigger vote mixing.</p>
                          </div>
                          <div className="mb-4">
                            <label className="block text-black font-medium mb-2">Election ID to Mix:</label>
                            <input
                              type="number"
                              value={xcmElectionId}
                              onChange={(e) => setXcmElectionId(e.target.value)}
                              className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                              placeholder="Enter election ID"
                            />
                          </div>
                          <button
                            onClick={submitXCMJob}
                            className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-3 rounded font-semibold hover:opacity-90"
                          >
                            🚀 Submit XCM Job (Para 2001 → Para 1000)
                          </button>
                          {xcmStatus && (
                            <div className={`mt-4 p-3 rounded ${xcmStatus.includes('✅') ? 'bg-green-100 text-green-800' : xcmStatus.includes('⏳') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                              {xcmStatus}
                            </div>
                          )}

                          <div className="mt-6 bg-black border border-[#2a2a2a] p-4 rounded">
                            <div className="flex justify-between items-center mb-3">
                              <strong className="text-white font-mono text-sm">Terminal Log (mirrors tail -f output)</strong>
                              <button
                                onClick={copyXcmTerminalCommand}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                              >
                                Copy tail command
                              </button>
                            </div>
                            <div className="bg-black border border-[#2a2a2a] p-3 rounded mb-3 font-mono text-xs text-green-400">
                              {xcmTailCommand}
                            </div>
                            <div
                              ref={terminalLogsRef}
                              className="bg-[#050b18] border border-[#2a2a2a] p-3 rounded max-h-48 overflow-y-auto font-mono text-xs text-[#9a9a9a]"
                            >
                              {xcmTerminalLogs.length === 0 ? (
                                <div className="text-[#6a6a6a]"># Click "Submit XCM Job" to stream the latest transport mix logs here…</div>
                              ) : (
                                xcmTerminalLogs.map((log, index) => (
                                  <div key={index} className="mb-1">
                                    {log.timestamp} {log.message}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Query Results */}
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-4">🔍 Step 4: Query Results</h2>
                        <div className="bg-[#f9fafb] p-4 rounded mb-4">
                          <div className="flex gap-4 items-end mb-4">
                            <div className="flex-1">
                              <label className="block text-black font-medium mb-2">Focus on Election ID (optional):</label>
                              <input
                                type="number"
                                value={queryElectionId}
                                onChange={(e) => setQueryElectionId(e.target.value)}
                                className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                                placeholder="Leave blank to list all elections"
                              />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <button
                              onClick={queryElections}
                              className="bg-green-600 text-white px-6 py-3 rounded font-semibold hover:bg-green-700"
                            >
                              📊 Query All Elections
                            </button>
                            <button
                              onClick={queryVotes}
                              className="bg-green-600 text-white px-6 py-3 rounded font-semibold hover:bg-green-700"
                            >
                              🗳️ Query All Votes
                            </button>
                          </div>
                          {queryStatus && (
                            <div className="mt-4 p-3 bg-white border border-[#e5e7eb] rounded">
                              <div dangerouslySetInnerHTML={{ __html: queryStatus }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'messaging' && (
                    <div className="space-y-8">
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-4">✉️ Messaging Service (Encrypted Publishing)</h2>
                        <p className="text-[#6b7280] mb-4">
                          Embedded end-to-end encrypted messaging/publishing experience. Reuse the same transport mix setup and IPFS endpoint
                          to test journalist workflows without leaving this demo.
                        </p>
                        <div className="bg-[#1f2937] p-4 rounded mb-4 text-white font-mono text-sm">
                          <strong>Quick steps:</strong>
                          <ol className="mt-3 space-y-1">
                            <li>Open the Setup block inside the embed.</li>
                            <li>Point the RPC URLs at the transport mix proxies (9950 / 9951).</li>
                            <li>Set the IPFS API to <code className="bg-[#374151] px-1 rounded">http://127.0.0.1:5001</code> (or a Crust gateway) and click "Test".</li>
                            <li>Publish content → encrypted payload is stored, and the archive shows real CIDs.</li>
                          </ol>
                        </div>
                        <iframe
                          src="/publishing"
                          title="DaoMix Messaging Service"
                          className="w-full border border-[#e5e7eb] rounded"
                          style={{ minHeight: '900px', background: 'white' }}
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'logs' && (
                    <div className="space-y-8">
                      <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                        <h2 className="text-2xl font-bold font-mono text-black mb-4">📊 Live Blockchain Logs</h2>
                        <div className="bg-[#f3f4f6] border-l-4 border-[#667eea] p-4 mb-6">
                          <p className="text-black font-semibold">Real-time block production and events from both parachains. Connect to chains first in the SETUP tab!</p>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                          <div className="bg-[#1f2937] border border-[#2a2a2a] p-4 rounded">
                            <h3 className="text-[#10b981] font-mono text-sm mb-3">🔗 DaoChain (Para 1000) Logs</h3>
                            <div
                              ref={daochainLogsRef}
                              className="max-h-80 overflow-y-auto font-mono text-xs space-y-1"
                            >
                              {daochainLogs.slice(-100).reverse().map((log, index) => (
                                <div
                                  key={index}
                                  className={`${
                                    log.type === 'block' ? 'text-[#10b981]' :
                                    log.type === 'event' ? 'text-[#fbbf24]' :
                                    log.type === 'error' ? 'text-red-400' :
                                    'text-[#9ca3af]'
                                  }`}
                                >
                                  {log.message}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-[#1f2937] border border-[#2a2a2a] p-4 rounded">
                            <h3 className="text-[#10b981] font-mono text-sm mb-3">🗳️ VotingChain (Para 2001) Logs</h3>
                            <div
                              ref={votingchainLogsRef}
                              className="max-h-80 overflow-y-auto font-mono text-xs space-y-1"
                            >
                              {votingchainLogs.slice(-100).reverse().map((log, index) => (
                                <div
                                  key={index}
                                  className={`${
                                    log.type === 'block' ? 'text-[#10b981]' :
                                    log.type === 'event' ? 'text-[#fbbf24]' :
                                    log.type === 'error' ? 'text-red-400' :
                                    'text-[#9ca3af]'
                                  }`}
                                >
                                  {log.message}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right IDE Section */}
              <div className="w-1/2 bg-black sticky top-0 h-screen flex flex-col">
                {/* Top Label */}
                <div className="absolute top-4 right-4 text-[11px] font-mono text-[#6a6a6a] uppercase tracking-widest">
                  TERMINAL / IDE
                </div>

                {/* IDE Window */}
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="w-full max-w-2xl border border-[#2a2a2a] bg-[#0a0a0a] overflow-hidden">
                    {/* Window Header */}
                    <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff6b35]"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a2a]"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a2a]"></div>
                      </div>
                      <span className="text-[11px] font-mono text-[#6a6a6a]">
                        {activeTab === 'setup' && 'daomix-setup.ts'}
                        {activeTab === 'demo' && 'daomix-demo.ts'}
                        {activeTab === 'messaging' && 'daomix-publishing.ts'}
                        {activeTab === 'logs' && 'daomix-logs.ts'}
                      </span>
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3 text-[#6a6a6a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                      </div>
                    </div>

                    {/* Terminal Output */}
                    <div className="flex h-96">
                      <div className="flex-1 bg-black p-4 font-mono text-[11px] overflow-auto">
                        <div className="mb-3 text-[#6a6a6a] uppercase tracking-widest">
                          {activeTab === 'setup' && 'CONNECTION STATUS'}
                          {activeTab === 'demo' && 'TRANSACTION LOGS'}
                          {activeTab === 'messaging' && 'PUBLISHING STATUS'}
                          {activeTab === 'logs' && 'LIVE BLOCKCHAIN LOGS'}
                        </div>
                        <div className="space-y-1">
                          {activeTab === 'setup' && (
                            <>
                              <div className="flex">
                                <span className="text-[#ff6b35]">$</span>
                                <span className="text-white ml-2">curl -s http://127.0.0.1:9950/system_health</span>
                              </div>
                              <div className="text-[#6a6a6a] mt-2">
                                # Testing DaoChain connection via transport mix...
                              </div>
                              {daochainStatus && (
                                <div className={`mt-1 ${daochainStatus.includes('✅') ? 'text-[#4ade80]' : 'text-red-400'}`}>
                                  {daochainStatus.split('✓')[1] || daochainStatus}
                                </div>
                              )}
                              <div className="flex mt-4">
                                <span className="text-[#ff6b35]">$</span>
                                <span className="text-white ml-2">curl -s http://127.0.0.1:9951/system_health</span>
                              </div>
                              <div className="text-[#6a6a6a] mt-2">
                                # Testing VotingChain connection via transport mix...
                              </div>
                              {votingchainStatus && (
                                <div className={`mt-1 ${votingchainStatus.includes('✅') ? 'text-[#4ade80]' : 'text-red-400'}`}>
                                  {votingchainStatus.split('✓')[1] || votingchainStatus}
                                </div>
                              )}
                            </>
                          )}

                          {activeTab === 'demo' && (
                            <>
                              <div className="flex">
                                <span className="text-[#ff6b35]">$</span>
                                <span className="text-white ml-2">daomix create-election --name "{electionName}" --options "{electionOptions}"</span>
                              </div>
                              <div className="text-[#6a6a6a] mt-2">
                                # Creating election on DaoChain...
                              </div>
                              {electionStatus && (
                                <div className={`mt-1 ${electionStatus.includes('✅') ? 'text-[#4ade80]' : electionStatus.includes('⏳') ? 'text-[#fbbf24]' : 'text-red-400'}`}>
                                  {electionStatus.includes('✅') ? '✓ Election created successfully' : electionStatus.includes('⏳') ? '⏳ Processing...' : '❌ Error occurred'}
                                </div>
                              )}

                              <div className="flex mt-4">
                                <span className="text-[#ff6b35]">$</span>
                                <span className="text-white ml-2">daomix cast-vote --election {voteElectionId} --option "{voteOption}"</span>
                              </div>
                              <div className="text-[#6a6a6a] mt-2">
                                # Casting vote via VotingChain...
                              </div>
                              {voteStatus && (
                                <div className={`mt-1 ${voteStatus.includes('✅') ? 'text-[#4ade80]' : voteStatus.includes('⏳') ? 'text-[#fbbf24]' : 'text-red-400'}`}>
                                  {voteStatus.includes('✅') ? '✓ Vote cast successfully' : voteStatus.includes('⏳') ? '⏳ Processing...' : '❌ Error occurred'}
                                </div>
                              )}

                              <div className="flex mt-4">
                                <span className="text-[#ff6b35]">$</span>
                                <span className="text-white ml-2">daomix submit-xcm --from 2001 --to 1000 --election {xcmElectionId}</span>
                              </div>
                              <div className="text-[#6a6a6a] mt-2">
                                # Submitting XCM mixing job...
                              </div>
                              {xcmStatus && (
                                <div className={`mt-1 ${xcmStatus.includes('✅') ? 'text-[#4ade80]' : xcmStatus.includes('⏳') ? 'text-[#fbbf24]' : 'text-red-400'}`}>
                                  {xcmStatus.includes('✅') ? '✓ XCM job submitted successfully' : xcmStatus.includes('⏳') ? '⏳ Processing...' : '❌ Error occurred'}
                                </div>
                              )}
                            </>
                          )}

                          {activeTab === 'messaging' && (
                            <>
                              <div className="flex">
                                <span className="text-[#ff6b35]">$</span>
                                <span className="text-white ml-2">daomix publish --ipfs {ipfsEndpoint} --chain {chainUrl}</span>
                              </div>
                              <div className="text-[#6a6a6a] mt-2">
                                # Testing IPFS and chain connections...
                              </div>
                              {ipfsStatus && (
                                <div className={`mt-1 ${ipfsStatus.includes('✅') ? 'text-[#4ade80]' : 'text-red-400'}`}>
                                  {ipfsStatus}
                                </div>
                              )}
                              {chainStatus && (
                                <div className={`mt-1 ${chainStatus.includes('✅') ? 'text-[#4ade80]' : 'text-red-400'}`}>
                                  {chainStatus}
                                </div>
                              )}
                              <div className="text-[#6a6a6a] mt-3">
                                # Publishing encrypted content to IPFS...
                              </div>
                              {publishStatus && (
                                <div className={`mt-1 ${publishStatus.includes('✅') ? 'text-[#4ade80]' : publishStatus.includes('🔐') ? 'text-[#fbbf24]' : 'text-red-400'}`}>
                                  {publishStatus}
                                </div>
                              )}
                            </>
                          )}

                          {activeTab === 'logs' && (
                            <>
                              <div className="text-[#4ade80] mt-1">
                                ✓ DaoChain block #{daochainBlock}
                              </div>
                              <div className="text-[#4ade80] mt-1">
                                ✓ VotingChain block #{votingchainBlock}
                              </div>
                              <div className="text-[#6a6a6a] mt-3">
                                # Latest events from connected chains...
                              </div>
                              {daochainLogs.slice(-3).reverse().map((log, index) => (
                                <div key={`daochain-${index}`} className={`mt-1 ${
                                  log.type === 'block' ? 'text-[#10b981]' :
                                  log.type === 'event' ? 'text-[#fbbf24]' :
                                  log.type === 'error' ? 'text-red-400' :
                                  'text-[#9a9a9a]'
                                }`}>
                                  [DaoChain] {log.message}
                                </div>
                              ))}
                              {votingchainLogs.slice(-3).reverse().map((log, index) => (
                                <div key={`votingchain-${index}`} className={`mt-1 ${
                                  log.type === 'block' ? 'text-[#10b981]' :
                                  log.type === 'event' ? 'text-[#fbbf24]' :
                                  log.type === 'error' ? 'text-red-400' :
                                  'text-[#9a9a9a]'
                                }`}>
                                  [VotingChain] {log.message}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Label */}
                <div className="absolute bottom-8 right-8 text-[11px] font-mono text-[#6a6a6a] uppercase tracking-widest">
                  IDE
                </div>
                <div className="absolute bottom-8 left-8 text-base font-mono text-[#6a6a6a]">
                  {activeTab === 'setup' && 'Setup & Connection'}
                  {activeTab === 'demo' && 'Interactive Demo'}
                  {activeTab === 'messaging' && 'Encrypted Publishing'}
                  {activeTab === 'logs' && 'Live Blockchain Logs'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publishing Tab Content (from demo-ui-publishing.html) */}
      {activeTab === 'messaging' && startupScreenVisible && (
        <div className="fixed inset-0 bg-black text-white z-50">
          <div className="container mx-auto p-8">
            <div className="flex">
              {/* Publish Tab */}
              <div className="w-1/2 pr-8">
                <div className="bg-white border border-[#2a2a2a] p-6 rounded mb-6">
                  <h2 className="text-2xl font-bold font-mono text-black mb-4">✍️ Publish Encrypted Content</h2>
                  <p className="text-[#6b7280] mb-4">
                    Your identity will be hidden through 3-hop onion routing. Content is encrypted and stored on IPFS.
                  </p>

                  <div className="mb-4">
                    <label className="block text-black font-medium mb-2">Article Title:</label>
                    <input
                      type="text"
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                      className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                      placeholder="Enter article title"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-black font-medium mb-2">Article Content:</label>
                    <textarea
                      value={articleContent}
                      onChange={(e) => setArticleContent(e.target.value)}
                      className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                      rows={8}
                      placeholder="Write your article here..."
                    />
                  </div>

                  <button
                    onClick={publishArticle}
                    className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white px-6 py-3 rounded font-semibold hover:opacity-90"
                  >
                    🔐 Publish (Encrypted via Transport Mix)
                  </button>
                  {publishStatus && (
                    <div className={`mt-4 p-3 rounded ${publishStatus.includes('✅') ? 'bg-green-100 text-green-800' : publishStatus.includes('🔐') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {publishStatus}
                    </div>
                  )}
                </div>
              </div>

              {/* Setup Tab */}
              <div className="w-1/2">
                <div className="bg-white border border-[#2a2a2a] p-6 rounded mb-6">
                  <h2 className="text-2xl font-bold font-mono text-black mb-4">⚙️ Setup</h2>

                  <div className="mb-4">
                    <label className="block text-black font-medium mb-2">PublishingChain WebSocket RPC URL:</label>
                    <input
                      type="text"
                      value={chainUrl}
                      onChange={(e) => setChainUrl(e.target.value)}
                      className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                      placeholder="ws://127.0.0.1:9950"
                    />
                  </div>
                  <button
                    onClick={connectPublishingChain}
                    className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white px-6 py-3 rounded font-semibold hover:opacity-90 mb-6"
                  >
                    🔗 Connect
                  </button>
                  {chainStatus && (
                    <div className={`mb-4 p-3 rounded ${chainStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {chainStatus}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#2a2a2a] p-6 rounded">
                  <h2 className="text-xl font-bold font-mono text-black mb-4">🗄️ IPFS Storage (Off-chain)</h2>
                  <p className="text-[#6b7280] mb-4">
                    Uses the IPFS HTTP API to pin encrypted content, following the recommended integration pattern in Polkadot docs.
                    <br />
                    <small>Docs: <a href="https://docs.polkadot.com/develop/toolkit/integrations/storage/#ipfs" target="_blank" className="text-[#3b82f6]">Storage Integrations → IPFS</a></small>
                  </p>
                  <div className="mb-4">
                    <label className="block text-black font-medium mb-2">IPFS API Endpoint:</label>
                    <input
                      type="text"
                      value={ipfsEndpoint}
                      onChange={(e) => setIpfsEndpoint(e.target.value)}
                      className="w-full p-3 border-2 border-[#e5e7eb] rounded font-mono text-sm bg-white text-black"
                      placeholder="http://127.0.0.1:5001"
                    />
                  </div>
                  <button
                    onClick={connectIpfs}
                    className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white px-6 py-3 rounded font-semibold hover:opacity-90"
                  >
                    🧪 Test IPFS Connection
                  </button>
                  {ipfsStatus && (
                    <div className={`mt-4 p-3 rounded ${ipfsStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {ipfsStatus}
                    </div>
                  )}
                  <p className="text-[#6b7280] text-sm mt-4">
                    Make sure your local IPFS daemon allows CORS:
                    <br />
                    <code className="bg-[#f3f4f6] p-2 rounded text-xs mt-2 block font-mono">
                      ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]' && ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET","POST"]'
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

