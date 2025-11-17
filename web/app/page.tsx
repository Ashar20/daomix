import Navbar from "./components/Navbar";
import DiagonalTexture from "./components/DiagonalTexture";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="px-6 min-h-[calc(100vh-15rem)] flex items-center">
        <div className="max-w-6xl ml-[3rem] w-full">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-1.5 h-1.5 bg-[#ff6b35] rounded-full animate-pulse"></div>
            <span className="text-[11px] uppercase tracking-widest text-[#9a9a9a] font-mono">DAOMIX PLATFORM</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold font-mono leading-tight mb-4 tracking-tight">
            Anonymous voting.<br />
            Verifiable results.
          </h1>
          <p className="text-base text-[#9a9a9a] mb-6 max-w-3xl font-mono leading-relaxed">
            Privacy-preserving governance infrastructure for Polkadot parachains
          </p>
          <div className="flex gap-3">
            <a 
              href="#docs" 
              className="px-6 py-3 bg-[#ff6b35] hover:bg-[#e55a2b] text-black font-mono font-bold text-[11px] uppercase tracking-widest transition-colors border border-[#ff6b35] btn-animated-texture"
            >
              GET STARTED →
            </a>
            <a 
              href="/sandbox" 
              className="px-6 py-3 border border-[#2a2a2a] hover:border-[#ff6b35] text-[#9a9a9a] hover:text-[#ff6b35] font-mono font-bold text-[11px] uppercase tracking-widest transition-colors"
            >
              TRY SANDBOX
            </a>
          </div>
        </div>
      </section>

      {/* Main Content Section with Terminal */}
      <section id="features" className="border-t border-[#2a2a2a] scroll-mt-10 relative isolate">
        <div className="flex min-h-screen">
          {/* Left Content */}
          <div className="w-1/2 border-r border-[#2a2a2a]">
            {/* Core Features */}
            <div className="py-8 px-6 border-b border-[#2a2a2a]">
              <div className="flex items-start gap-1.5 mb-3">
                <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
                <span className="text-[11px] uppercase tracking-widest text-[#9a9a9a] font-mono">CORE FEATURES</span>
              </div>
              <h2 className="text-3xl font-bold font-mono mb-4 tracking-tight">
                Key Capabilities
              </h2>
              <div className="space-y-2 text-[#9a9a9a] text-xs font-mono leading-relaxed">
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Zero trust governance</span> — anonymous voting + verifiable tallies</p>
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Censorship-proof publishing</span> — encrypted IPFS/Crust storage</p>
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Transport mix</span> — 3-hop onion relay hides RPC metadata</p>
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Regulator-ready</span> — Merkle commitments + XCM audit trails</p>
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Polkadot-native</span> — Real Substrate runtimes, XCM V4, production pallets</p>
              </div>
            </div>

            {/* Architecture Overview */}
            <div className="py-8 px-6 border-b border-[#2a2a2a]">
              <div className="flex items-start gap-1.5 mb-3">
                <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
                <span className="text-[11px] uppercase tracking-widest text-[#9a9a9a] font-mono">ARCHITECTURE</span>
              </div>
              <h2 className="text-3xl font-bold font-mono mb-4 tracking-tight">
                Three-Layer Stack
              </h2>
              <div className="space-y-2 text-xs font-mono">
                <div className="border-l-2 border-[#ff6b35] pl-3 py-1">
                  <p className="text-white mb-1">Layer 1: Substrate Parachains</p>
                  <p className="text-[#9a9a9a]">DaoChain (Para 1000) + VotingChain (Para 2001)</p>
                  <p className="text-[#6a6a6a] text-[11px]">pallet-mix-job • pallet-daomix-voting • XCM V4</p>
                </div>
                <div className="border-l-2 border-[#ff6b35] pl-3 py-1">
                  <p className="text-white mb-1">Layer 2: Chaum Mixnet</p>
                  <p className="text-[#9a9a9a]">3 HTTP nodes (9000/9001/9002)</p>
                  <p className="text-[#6a6a6a] text-[11px]">X25519 + XChaCha20-Poly1305 • Fisher-Yates shuffle • Merkle commitments</p>
                </div>
                <div className="border-l-2 border-[#ff6b35] pl-3 py-1">
                  <p className="text-white mb-1">Layer 3: Transport Mix</p>
                  <p className="text-[#9a9a9a]">Entry→Middle→Exit (9100/9101/9102)</p>
                  <p className="text-[#6a6a6a] text-[11px]">JSON-RPC onion routing • WS proxies (9950/9951) • IP obfuscation</p>
                </div>
              </div>
            </div>

            {/* Data Flow */}
            <div id="how-it-works" className="py-8 px-6 scroll-mt-10">
              <div className="flex items-start gap-1.5 mb-3">
                <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
                <span className="text-[11px] uppercase tracking-widest text-[#9a9a9a] font-mono">DATA FLOW</span>
              </div>
              <h2 className="text-3xl font-bold font-mono mb-4 tracking-tight">
                Request Path
              </h2>
              <div className="space-y-2">
                {[
                  { num: "01", title: "Browser", desc: "WsProvider → ws://127.0.0.1:9950" },
                  { num: "02", title: "Transport Entry", desc: "Peel 1st layer → Forward to Middle" },
                  { num: "03", title: "Transport Middle", desc: "Peel 2nd layer → Forward to Exit" },
                  { num: "04", title: "Transport Exit", desc: "Peel 3rd layer → DaoChain RPC" },
                  { num: "05", title: "Parachain", desc: "Process tx → Emit events → Store state" },
                ].map((step) => (
                  <div key={step.num} className="flex gap-2 items-start border-l border-[#2a2a2a] pl-2 py-1 hover:border-[#ff6b35] transition-colors">
                    <span className="text-base font-bold font-mono text-[#ff6b35] leading-none">{step.num}</span>
                    <div>
                      <h3 className="text-xs font-bold font-mono">{step.title}</h3>
                      <p className="text-[#9a9a9a] text-[11px] font-mono">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - IDE/Terminal Mockup */}
          <div className="w-1/2 bg-[#0a0a0a] sticky top-10 self-start overflow-hidden" style={{ maxHeight: 'calc(100vh - 2.5rem)' }}>
            {/* Terminal Header */}
            <div className="border-b border-[#2a2a2a] p-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#ff6b35]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#2a2a2a]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#2a2a2a]"></div>
                </div>
                <div className="flex gap-4 text-[11px] font-mono">
                  <span className="text-[#ff6b35]">TERMINAL / IDE</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[#2a2a2a] flex text-[11px] font-mono flex-shrink-0">
              <div className="px-4 py-2 bg-[#1a1a1a] border-r border-[#2a2a2a] text-white">
                01 TERMINAL / IDE
              </div>
              <div className="px-4 py-2 border-r border-[#2a2a2a] text-[#6a6a6a] hover:text-white cursor-pointer">
                02 WEB BROWSER
              </div>
              <div className="px-4 py-2 border-r border-[#2a2a2a] text-[#6a6a6a] hover:text-white cursor-pointer">
                03 COMMAND LINE
              </div>
            </div>

            {/* IDE Content */}
            <div className="p-6 font-mono text-xs custom-scrollbar" style={{ height: 'calc(100vh - 10rem)', overflowY: 'scroll' }}>
              {/* Explorer */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 text-[#9a9a9a]">
                  <span className="text-[11px]">▼</span>
                  <span className="text-white font-bold">EXPLORER</span>
                </div>
                <div className="ml-4 space-y-1 text-[#9a9a9a]">
                  <div className="flex items-center gap-2 hover:text-white cursor-pointer">
                    <span>▼</span>
                    <span className="text-[#ff6b35]">daomix</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    <div className="flex items-center gap-2 hover:text-white cursor-pointer">
                      <span>▶</span>
                      <span>contracts/</span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white cursor-pointer">
                      <span>▶</span>
                      <span>mixer/</span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white cursor-pointer">
                      <span>▶</span>
                      <span>sdk/</span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white cursor-pointer">
                      <span>▶</span>
                      <span>dapp/</span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white cursor-pointer">
                      <span>▶</span>
                      <span>polokol-chain/</span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white cursor-pointer">
                      <span>▶</span>
                      <span>scripts/</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <span>□</span>
                      <span>package.json</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <span>□</span>
                      <span>README.md</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Editor - XCM Example */}
              <div className="border border-[#2a2a2a] bg-black p-4 mb-4">
                <div className="mb-2 text-[#6a6a6a] text-[11px]">examples/xcm-mix-job.ts</div>
                <div className="space-y-1 text-[10px]">
                  <p><span className="text-[#9a9a9a]"> 1</span>  <span className="text-[#6a6a6a]">// Send XCM from Para 2001 to trigger mixing on Para 1000</span></p>
                  <p><span className="text-[#9a9a9a]"> 2</span>  <span className="text-[#ff6b35]">const</span> <span className="text-white">dest</span> <span className="text-white">=</span> {'{'} <span className="text-white">V3:</span> {'{'} <span className="text-white">parents:</span> <span className="text-[#fbbf24]">1</span>, <span className="text-white">interior:</span> {'{'} <span className="text-white">X1:</span> {'{'} <span className="text-white">Parachain:</span> <span className="text-[#fbbf24]">1000</span> {'}'} {'}'} {'}'} {'}'};</p>
                  <p><span className="text-[#9a9a9a]"> 3</span></p>
                  <p><span className="text-[#9a9a9a]"> 4</span>  <span className="text-[#ff6b35]">const</span> <span className="text-white">message</span> <span className="text-white">=</span> {'{'}</p>
                  <p><span className="text-[#9a9a9a]"> 5</span>    <span className="text-white">V3:</span> [{'{'}</p>
                  <p><span className="text-[#9a9a9a]"> 6</span>      <span className="text-white">Transact:</span> {'{'}</p>
                  <p><span className="text-[#9a9a9a]"> 7</span>        <span className="text-white">originKind:</span> <span className="text-[#fbbf24]">'SovereignAccount'</span>,</p>
                  <p><span className="text-[#9a9a9a]"> 8</span>        <span className="text-white">requireWeightAtMost:</span> {'{'} <span className="text-white">refTime:</span> <span className="text-[#fbbf24]">1000000000</span> {'}'},</p>
                  <p><span className="text-[#9a9a9a]"> 9</span>        <span className="text-white">call:</span> {'{'} <span className="text-white">encoded:</span> <span className="text-white">api</span>.<span className="text-white">tx</span>.<span className="text-white">mixJob</span>.<span className="text-white">submitJob</span>(<span className="text-white">electionId</span>).<span className="text-white">method</span>.<span className="text-[#ff6b35]">toHex</span>() {'}'}</p>
                  <p><span className="text-[#9a9a9a]">10</span>      {'}'}</p>
                  <p><span className="text-[#9a9a9a]">11</span>    {'}'}]</p>
                  <p><span className="text-[#9a9a9a]">12</span>  {'}'};</p>
                  <p><span className="text-[#9a9a9a]">13</span></p>
                  <p><span className="text-[#9a9a9a]">14</span>  <span className="text-[#ff6b35]">await</span> <span className="text-white">votingchainApi</span>.<span className="text-white">tx</span>.<span className="text-white">polkadotXcm</span>.<span className="text-[#ff6b35]">send</span>(<span className="text-white">dest</span>, <span className="text-white">message</span>).<span className="text-[#ff6b35]">signAndSend</span>(<span className="text-white">alice</span>);</p>
                </div>
              </div>

              {/* Code Editor - Mix Node */}
              <div className="border border-[#2a2a2a] bg-black p-4 mb-4">
                <div className="mb-2 text-[#6a6a6a] text-[11px]">mixer/mixNodeServer.ts</div>
                <div className="space-y-1 text-[10px]">
                  <p><span className="text-[#9a9a9a]"> 1</span>  <span className="text-[#6a6a6a]">// Mix node receives ciphertexts, peels onion layer, shuffles</span></p>
                  <p><span className="text-[#9a9a9a]"> 2</span>  <span className="text-white">app</span>.<span className="text-[#ff6b35]">post</span>(<span className="text-[#fbbf24]">'/mix'</span>, <span className="text-[#ff6b35]">async</span> (<span className="text-white">req</span>, <span className="text-white">res</span>) <span className="text-white">=&gt;</span> {'{'}</p>
                  <p><span className="text-[#9a9a9a]"> 3</span>    <span className="text-[#ff6b35]">const</span> {'{'} <span className="text-white">ciphertexts</span>, <span className="text-white">nodeIndex</span> {'}'} <span className="text-white">=</span> <span className="text-white">req</span>.<span className="text-white">body</span>;</p>
                  <p><span className="text-[#9a9a9a]"> 4</span></p>
                  <p><span className="text-[#9a9a9a]"> 5</span>    <span className="text-[#6a6a6a]">// Peel one onion layer using node's private key</span></p>
                  <p><span className="text-[#9a9a9a]"> 6</span>    <span className="text-[#ff6b35]">const</span> <span className="text-white">peeled</span> <span className="text-white">=</span> <span className="text-white">ciphertexts</span>.<span className="text-[#ff6b35]">map</span>(<span className="text-white">ct</span> <span className="text-white">=&gt;</span> </p>
                  <p><span className="text-[#9a9a9a]"> 7</span>      <span className="text-[#ff6b35]">peelOnionForNode</span>(<span className="text-white">ct</span>, <span className="text-white">nodeIndex</span>, <span className="text-white">NODE_PRIVATE_KEYS</span>[<span className="text-white">nodeIndex</span>])</p>
                  <p><span className="text-[#9a9a9a]"> 8</span>    );</p>
                  <p><span className="text-[#9a9a9a]"> 9</span></p>
                  <p><span className="text-[#9a9a9a]">10</span>    <span className="text-[#6a6a6a]">// Fisher-Yates shuffle for unlinkability</span></p>
                  <p><span className="text-[#9a9a9a]">11</span>    <span className="text-[#ff6b35]">const</span> <span className="text-white">shuffled</span> <span className="text-white">=</span> <span className="text-[#ff6b35]">fisherYatesShuffle</span>(<span className="text-white">peeled</span>);</p>
                  <p><span className="text-[#9a9a9a]">12</span></p>
                  <p><span className="text-[#9a9a9a]">13</span>    <span className="text-white">res</span>.<span className="text-[#ff6b35]">json</span>({'{'} <span className="text-white">shuffled</span>, <span className="text-white">commitment:</span> <span className="text-[#ff6b35]">hash</span>(<span className="text-white">shuffled</span>) {'}'});</p>
                  <p><span className="text-[#9a9a9a]">14</span>  {'}'});</p>
                </div>
              </div>

              {/* Terminal Output */}
              <div className="border border-[#2a2a2a] bg-black p-4">
                <div className="mb-2 text-[#6a6a6a] text-[11px]">TERMINAL OUTPUT</div>
                <div className="space-y-1 text-[10px]">
                  <p><span className="text-[#ff6b35]">$</span> <span className="text-white">npm run demo:start</span></p>
                  <p className="text-[#6a6a6a]"># Starting DaoMix full stack...</p>
                  <p className="text-[#9a9a9a]">[substrate] DaoChain (Para 1000) starting on port 9944...</p>
                  <p className="text-[#9a9a9a]">[substrate] VotingChain (Para 2001) starting on port 9945...</p>
                  <p className="text-[#9a9a9a]">[mixer] Mix node 1 listening on :9000</p>
                  <p className="text-[#9a9a9a]">[mixer] Mix node 2 listening on :9001</p>
                  <p className="text-[#9a9a9a]">[mixer] Mix node 3 listening on :9002</p>
                  <p className="text-[#9a9a9a]">[transport] Entry node started :9100</p>
                  <p className="text-[#9a9a9a]">[transport] Middle node started :9101</p>
                  <p className="text-[#9a9a9a]">[transport] Exit node started :9102</p>
                  <p className="text-[#9a9a9a]">[ws-proxy] DaoChain proxy → ws://127.0.0.1:9950</p>
                  <p className="text-[#9a9a9a]">[ws-proxy] VotingChain proxy → ws://127.0.0.1:9951</p>
                  <p className="text-[#9a9a9a]">[orchestrator] Monitoring mix jobs on DaoChain...</p>
                  <p className="text-[#9a9a9a]">[ui-server] Demo UI serving on :8080</p>
                  <p className="text-[#4ade80] mt-2">✓ All services operational</p>
                  <p className="text-[#ff6b35]">→ Open http://127.0.0.1:8080</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Feature Matrix */}
      <section id="architecture" className="py-8 px-6 border-t border-[#2a2a2a] scroll-mt-10 relative overflow-hidden bg-black z-10">
        <DiagonalTexture />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-start gap-1.5 mb-4">
            <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
            <span className="text-[11px] uppercase tracking-widest text-[#9a9a9a] font-mono">FEATURE MATRIX</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold font-mono mb-6 tracking-tight">
            What You Get
          </h2>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-2 text-[#ff6b35]">PARACHAINS</h3>
              <p className="text-[#9a9a9a] text-xs font-mono mb-1">
                DaoChain (1000) • VotingChain (2001)
              </p>
              <p className="text-[#6a6a6a] text-[11px] font-mono">
                Sibling-parachain XCM flows
              </p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-2 text-[#ff6b35]">CHAUM MIXNET</h3>
              <p className="text-[#9a9a9a] text-xs font-mono mb-1">
                3 HTTP nodes • X25519 • XChaCha20-Poly1305
              </p>
              <p className="text-[#6a6a6a] text-[11px] font-mono">
                Fisher–Yates shuffle • Merkle proofs
              </p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-2 text-[#ff6b35]">TRANSPORT MIX</h3>
              <p className="text-[#9a9a9a] text-xs font-mono mb-1">
                Entry→Middle→Exit onion routing
              </p>
              <p className="text-[#6a6a6a] text-[11px] font-mono">
                JSON-RPC IP obfuscation
              </p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-2 text-[#ff6b35]">PALLETS</h3>
              <p className="text-[#9a9a9a] text-xs font-mono mb-1">
                pallet-mix-job • pallet-daomix-voting
              </p>
              <p className="text-[#6a6a6a] text-[11px] font-mono">
                Production-grade Substrate code
              </p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-2 text-[#ff6b35]">STORAGE</h3>
              <p className="text-[#9a9a9a] text-xs font-mono mb-1">
                IPFS • Crust Network
              </p>
              <p className="text-[#6a6a6a] text-[11px] font-mono">
                Encrypted off-chain payloads
              </p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-2 text-[#ff6b35]">AUTOMATION</h3>
              <p className="text-[#9a9a9a] text-xs font-mono mb-1">
                demo:setup • demo:start
              </p>
              <p className="text-[#6a6a6a] text-[11px] font-mono">
                Zero to full stack in minutes
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-8 px-6 border-t border-[#2a2a2a] scroll-mt-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-1.5 mb-4">
            <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
            <span className="text-[11px] uppercase tracking-widest text-[#9a9a9a] font-mono">USE CASES</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold font-mono mb-6 tracking-tight">
            Production Scenarios
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-1 text-white">DAO Governance</h3>
              <p className="text-[#9a9a9a] text-xs font-mono">
                Anonymous voting + verifiable tallies. Privacy + auditability.
              </p>
            </div>
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-1 text-white">Cross-Chain Referenda</h3>
              <p className="text-[#9a9a9a] text-xs font-mono">
                XCM into MixJob pallet from any parachain.
              </p>
            </div>
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-1 text-white">Encrypted Publishing</h3>
              <p className="text-[#9a9a9a] text-xs font-mono">
                E2E encryption • IPFS/Crust storage • Censorship-resistant.
              </p>
            </div>
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-1 text-white">Auditable Privacy</h3>
              <p className="text-[#9a9a9a] text-xs font-mono">
                On-chain Merkle commitments for compliance verification.
              </p>
            </div>
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-1 text-white">Sealed-Bid Auctions</h3>
              <p className="text-[#9a9a9a] text-xs font-mono">
                Mix-then-reveal prevents MEV and collusion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Quick Start */}
      <section id="docs" className="py-8 px-6 border-t border-[#2a2a2a] scroll-mt-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-1.5 mb-4">
            <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
            <span className="text-[11px] uppercase tracking-widest text-[#9a9a9a] font-mono">DEVELOPER QUICK START</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold font-mono mb-6 tracking-tight">
            Zero to Full Stack
          </h2>
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 font-mono text-xs mb-6">
            <div className="space-y-3">
              <div>
                <p className="text-[#6a6a6a] mb-1"># 1. Clone + install deps</p>
                <p className="text-[#4ade80]">git clone https://github.com/Ashar20/daomix.git</p>
                <p className="text-[#4ade80]">cd daomix && npm install</p>
              </div>
              <div>
                <p className="text-[#6a6a6a] mb-1"># 2. One-time full setup (build runtimes, install IPFS, generate keys)</p>
                <p className="text-[#ff6b35]">npm run demo:setup</p>
              </div>
              <div>
                <p className="text-[#6a6a6a] mb-1"># 3. Start everything: 2 parachains + 3 mix nodes + transport mix + UI</p>
                <p className="text-[#ff6b35]">npm run demo:start</p>
              </div>
              <div>
                <p className="text-[#6a6a6a] mb-1"># 4. Open UI</p>
                <p className="text-[#4ade80]">open http://127.0.0.1:8080</p>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="border border-[#2a2a2a] p-4">
              <h3 className="text-sm font-bold font-mono mb-2 text-[#ff6b35]">demo:setup</h3>
              <ul className="space-y-1 text-[#9a9a9a] text-[11px] font-mono">
                <li>• Build parachain runtimes</li>
                <li>• Install & configure IPFS</li>
                <li>• Generate chain specs</li>
                <li>• Create cryptographic keys</li>
              </ul>
            </div>
            <div className="border border-[#2a2a2a] p-4">
              <h3 className="text-sm font-bold font-mono mb-2 text-[#ff6b35]">demo:start</h3>
              <ul className="space-y-1 text-[#9a9a9a] text-[11px] font-mono">
                <li>• 2 parachains (9944/9945)</li>
                <li>• 3 mix nodes (9000-9002)</li>
                <li>• Transport mix (9100-9102)</li>
                <li>• WS proxies (9950/9951)</li>
                <li>• Orchestrator + UI (8080)</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <a 
              href="/sandbox" 
              className="inline-block px-6 py-3 bg-[#ff6b35] hover:bg-[#e55a2b] text-black font-mono font-bold text-[11px] uppercase tracking-widest transition-colors btn-animated-texture"
            >
              TRY SANDBOX →
            </a>
            <a 
              href="https://github.com/Ashar20/daomix" 
              className="inline-block px-6 py-3 border border-[#2a2a2a] hover:border-[#ff6b35] text-[#9a9a9a] hover:text-[#ff6b35] font-mono font-bold text-[11px] uppercase tracking-widest transition-colors"
            >
              VIEW ON GITHUB
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10 px-6 border-t border-[#2a2a2a] relative overflow-hidden">
        <DiagonalTexture />
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold font-mono mb-3 tracking-tight">
            No mocks. No screenshots.<br />
            Everything is production-grade.
          </h2>
          <p className="text-base text-[#9a9a9a] font-mono mb-6">
            Ship zero-knowledge governance, secure messaging, and privacy-preserving cross-chain workflows with DaoMix.
          </p>
          <div className="flex gap-3 justify-center">
            <a 
              href="https://github.com/Ashar20/daomix" 
              className="px-6 py-3 bg-[#ff6b35] hover:bg-[#e55a2b] text-black font-mono font-bold text-[11px] uppercase tracking-widest transition-colors btn-animated-texture"
            >
              GITHUB
            </a>
            <a
              href="/sandbox" 
              className="px-6 py-3 border border-[#2a2a2a] hover:border-[#ff6b35] text-[#9a9a9a] hover:text-[#ff6b35] font-mono font-bold text-[11px] uppercase tracking-widest transition-colors"
            >
              TRY SANDBOX
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-[#2a2a2a]">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[11px] font-mono text-[#6a6a6a]">
          <p>© 2025 DAOCHAIN. OPEN SOURCE.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-[#ff6b35] transition-colors">GITHUB</a>
            <a href="#" className="hover:text-[#ff6b35] transition-colors">DOCS</a>
            <a href="#" className="hover:text-[#ff6b35] transition-colors">TWITTER</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
