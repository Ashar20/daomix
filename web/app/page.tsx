import Navbar from "./components/Navbar";
import DiagonalTexture from "./components/DiagonalTexture";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-16 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-1.5 h-1.5 bg-[#ff6b35] rounded-full animate-pulse"></div>
            <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">VISION</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold font-mono leading-tight mb-4 tracking-tight">
            On-chain elections.<br />
            Zero leaked identities.
          </h1>
          <p className="text-base md:text-lg text-[#9a9a9a] mb-4 max-w-3xl font-mono leading-snug">
            Private ballots. Publicly verifiable results.
          </p>
          <p className="text-sm text-[#9a9a9a] mb-6 max-w-3xl font-mono leading-relaxed">
            DaoChain is a Polkadot parachain combined with a verifiable mixnet that enables DAOs to run fully trustless, 
            end-to-end encrypted elections without exposing voters or their network metadata.
          </p>
          <div className="flex gap-3">
            <a 
              href="#docs" 
              className="px-5 py-2.5 bg-[#ff6b35] hover:bg-[#e55a2b] text-black font-mono font-bold text-[9px] uppercase tracking-widest transition-colors border border-[#ff6b35]"
            >
              GET STARTED →
            </a>
            <a 
              href="#how" 
              className="px-5 py-2.5 border border-[#2a2a2a] hover:border-[#ff6b35] text-[#9a9a9a] hover:text-[#ff6b35] font-mono font-bold text-[9px] uppercase tracking-widest transition-colors"
            >
              VIEW DOCS
            </a>
          </div>
        </div>
      </section>

      {/* Main Content Section with Terminal */}
      <section id="features" className="border-t border-[#2a2a2a] scroll-mt-10 relative isolate">
        <div className="flex min-h-screen">
          {/* Left Content */}
          <div className="w-1/2 border-r border-[#2a2a2a]">
            {/* What DaoChain Does */}
            <div className="py-8 px-6 border-b border-[#2a2a2a]">
              <div className="flex items-start gap-1.5 mb-3">
                <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
                <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">WHAT DAOCHAIN DOES</span>
              </div>
              <h2 className="text-2xl font-bold font-mono mb-4 tracking-tight">
                Run elections that are:
              </h2>
              <div className="space-y-2 text-[#9a9a9a] text-[10px] font-mono leading-relaxed">
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Anonymous</span> — voters stay unlinked to their ballots</p>
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Encrypted</span> — every vote is locked until tally time</p>
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Mixed</span> — ballots pass through a verifiable mixnet</p>
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">Auditable</span> — DAO gets a public, tamper-proof result</p>
                <p><span className="text-[#ff6b35]">•</span> <span className="text-white">On-chain</span> — everything settles on Polkadot for full transparency</p>
              </div>
            </div>

            {/* Why It Matters */}
            <div className="py-8 px-6 border-b border-[#2a2a2a]">
              <div className="flex items-start gap-1.5 mb-3">
                <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
                <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">WHY IT MATTERS</span>
              </div>
              <h2 className="text-2xl font-bold font-mono mb-4 tracking-tight">
                DAOs can now run governance without:
              </h2>
              <div className="space-y-2 text-[#9a9a9a] text-[10px] font-mono leading-relaxed mb-4">
                <p><span className="text-[#ff6b35]">×</span> leaked wallets</p>
                <p><span className="text-[#ff6b35]">×</span> traceable metadata</p>
                <p><span className="text-[#ff6b35]">×</span> trusted admins</p>
                <p><span className="text-[#ff6b35]">×</span> off-chain vote manipulation</p>
              </div>
              <p className="text-[10px] font-mono text-white">
                You get <span className="text-[#ff6b35]">Ethereum-level integrity</span> with <span className="text-[#ff6b35]">Signal-level privacy</span>.
              </p>
            </div>

            {/* How It Works */}
            <div id="how-it-works" className="py-8 px-6 scroll-mt-10">
              <div className="flex items-start gap-1.5 mb-3">
                <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
                <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">HOW IT WORKS</span>
              </div>
              <h2 className="text-2xl font-bold font-mono mb-4 tracking-tight">
                How It Works
              </h2>
              <div className="space-y-2">
                {[
                  { num: "01", title: "Voter proves eligibility privately", desc: "Anonymous credential → no wallet exposure" },
                  { num: "02", title: "Ballot is encrypted", desc: "Vote sealed with threshold key" },
                  { num: "03", title: "Ballot enters the mixnet", desc: "Sharded, mixed, unlinkable to sender" },
                  { num: "04", title: "DAO receives mixed ballots", desc: "Chain checks proofs for validity" },
                  { num: "05", title: "Committee decrypts tally", desc: "Public result without seeing votes" },
                ].map((step) => (
                  <div key={step.num} className="flex gap-2 items-start border-l border-[#2a2a2a] pl-2 py-1 hover:border-[#ff6b35] transition-colors">
                    <span className="text-sm font-bold font-mono text-[#ff6b35] leading-none">{step.num}</span>
                    <div>
                      <h3 className="text-[10px] font-bold font-mono">{step.title}</h3>
                      <p className="text-[#9a9a9a] text-[9px] font-mono">{step.desc}</p>
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
                <div className="flex gap-4 text-[9px] font-mono">
                  <span className="text-[#ff6b35]">TERMINAL / IDE</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[#2a2a2a] flex text-[9px] font-mono flex-shrink-0">
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
            <div className="p-6 font-mono text-[10px] overflow-auto flex-1" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
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
                    <div className="flex items-center gap-2 text-white">
                      <span>□</span>
                      <span>package.json</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Editor */}
              <div className="border border-[#2a2a2a] bg-black p-4 mb-4">
                <div className="mb-2 text-[#6a6a6a] text-[9px]">orchestrator.ts</div>
                <div className="space-y-1">
                  <p><span className="text-[#9a9a9a]">1</span>  <span className="text-[#ff6b35]">import</span> <span className="text-[#4ade80]">{'{'}</span> <span className="text-white">ApiPromise</span> <span className="text-[#4ade80]">{'}'}</span> <span className="text-[#ff6b35]">from</span> <span className="text-[#fbbf24]">'@polkadot/api'</span><span className="text-white">;</span></p>
                  <p><span className="text-[#9a9a9a]">2</span>  <span className="text-[#ff6b35]">import</span> <span className="text-[#4ade80]">{'{'}</span> <span className="text-white">WsProvider</span> <span className="text-[#4ade80]">{'}'}</span> <span className="text-[#ff6b35]">from</span> <span className="text-[#fbbf24]">'@polkadot/rpc-provider'</span><span className="text-white">;</span></p>
                  <p><span className="text-[#9a9a9a]">3</span></p>
                  <p><span className="text-[#9a9a9a]">4</span>  <span className="text-[#6a6a6a]">// Create election on DaoChain</span></p>
                  <p><span className="text-[#9a9a9a]">5</span>  <span className="text-[#ff6b35]">export</span> <span className="text-[#ff6b35]">async</span> <span className="text-[#ff6b35]">function</span> <span className="text-[#4ade80]">createElection</span><span className="text-white">() {'{'}</span></p>
                  <p><span className="text-[#9a9a9a]">6</span>    <span className="text-[#ff6b35]">const</span> <span className="text-white">provider</span> <span className="text-white">=</span> <span className="text-[#ff6b35]">new</span> <span className="text-[#4ade80]">WsProvider</span><span className="text-white">(</span><span className="text-[#fbbf24]">'ws://127.0.0.1:9944'</span><span className="text-white">);</span></p>
                  <p><span className="text-[#9a9a9a]">7</span>    <span className="text-[#ff6b35]">const</span> <span className="text-white">api</span> <span className="text-white">=</span> <span className="text-[#ff6b35]">await</span> <span className="text-white">ApiPromise</span><span className="text-white">.</span><span className="text-[#4ade80]">create</span><span className="text-white">({'{'} provider {'}'});</span></p>
                  <p><span className="text-[#9a9a9a]">8</span>    <span className="text-[#6a6a6a]">// ...</span></p>
                  <p><span className="text-[#9a9a9a]">9</span>  <span className="text-white">{'}'}</span></p>
                </div>
              </div>

              {/* Terminal Output */}
              <div className="border border-[#2a2a2a] bg-black p-4">
                <div className="mb-2 text-[#6a6a6a] text-[9px]">TERMINAL OUTPUT</div>
                <div className="space-y-1">
                  <p><span className="text-[#ff6b35]">$</span> <span className="text-white">npm run run:daochain-pipeline</span></p>
                  <p className="text-[#6a6a6a]"># Creating election on DaoChain...</p>
                  <p><span className="text-[#4ade80]">✓</span> <span className="text-[#9a9a9a]">Election created: ID=1</span></p>
                  <p><span className="text-[#4ade80]">✓</span> <span className="text-[#9a9a9a]">Voters registered: 3</span></p>
                  <p><span className="text-[#4ade80]">✓</span> <span className="text-[#9a9a9a]">Ballots encrypted and cast</span></p>
                  <p><span className="text-[#4ade80]">✓</span> <span className="text-[#9a9a9a]">Mix-nodes processing...</span></p>
                  <p><span className="text-[#4ade80]">✓</span> <span className="text-[#9a9a9a]">Tally complete</span></p>
                  <p className="text-[#ff6b35]">DaoMix pipeline complete</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Technical Architecture */}
      <section id="architecture" className="py-8 px-6 border-t border-[#2a2a2a] scroll-mt-10 relative overflow-hidden bg-black z-10">
        <DiagonalTexture />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-start gap-1.5 mb-4">
            <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
            <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">TECHNICAL ARCHITECTURE</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-mono mb-6 tracking-tight">
            Three-Layer System
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="border border-[#2a2a2a] p-5 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-3 text-[#ff6b35]">SUBSTRATE CHAIN</h3>
              <p className="text-[#9a9a9a] text-[10px] font-mono leading-relaxed mb-3">
                Polkadot parachain built with Substrate framework for on-chain election management, 
                vote storage, and final tally commitment.
              </p>
              <ul className="space-y-1 text-[#9a9a9a] text-[9px] font-mono">
                <li>• DAO voting pallets</li>
                <li>• Mixnet registry</li>
                <li>• Proof verification</li>
                <li>• On-chain governance</li>
              </ul>
            </div>
            <div className="border border-[#2a2a2a] p-5 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-3 text-[#ff6b35]">MIXNET LAYER</h3>
              <p className="text-[#9a9a9a] text-[10px] font-mono leading-relaxed mb-3">
                cMix-inspired verifiable mixnet with onion encryption and cascade mixing 
                that breaks the link between voters and their ballots.
              </p>
              <ul className="space-y-1 text-[#9a9a9a] text-[9px] font-mono">
                <li>• Onion encryption</li>
                <li>• Cascade mixing</li>
                <li>• Metadata protection</li>
                <li>• JSON-RPC forwarding</li>
              </ul>
            </div>
            <div className="border border-[#2a2a2a] p-5 hover:border-[#ff6b35] transition-colors">
              <h3 className="text-sm font-bold font-mono mb-3 text-[#ff6b35]">CLIENT SDKs</h3>
              <p className="text-[#9a9a9a] text-[10px] font-mono leading-relaxed mb-3">
                Developer-friendly TypeScript and Rust SDKs for easy integration 
                with existing DAO infrastructure and governance tools.
              </p>
              <ul className="space-y-1 text-[#9a9a9a] text-[9px] font-mono">
                <li>• TypeScript SDK</li>
                <li>• Rust libraries</li>
                <li>• DotMixProvider</li>
                <li>• Next.js templates</li>
              </ul>
            </div>
          </div>

          {/* Key Features */}
          <div className="flex items-start gap-1.5 mb-4 mt-8">
            <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
            <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">CORE FEATURES</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h4 className="text-[10px] font-bold font-mono mb-2 text-white">Fully on-chain elections</h4>
              <p className="text-[#9a9a9a] text-[9px] font-mono">All election data and results are stored and verified on the Polkadot blockchain</p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h4 className="text-[10px] font-bold font-mono mb-2 text-white">cMix-style verifiable mixnet</h4>
              <p className="text-[#9a9a9a] text-[9px] font-mono">Cryptographically verifiable mixing process ensures ballot anonymity</p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h4 className="text-[10px] font-bold font-mono mb-2 text-white">zk-based eligibility proofs</h4>
              <p className="text-[#9a9a9a] text-[9px] font-mono">Zero-knowledge proofs verify voter eligibility without revealing identity</p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h4 className="text-[10px] font-bold font-mono mb-2 text-white">Threshold encryption</h4>
              <p className="text-[#9a9a9a] text-[9px] font-mono">Distributed key management prevents single-party ballot decryption</p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h4 className="text-[10px] font-bold font-mono mb-2 text-white">Proof-based tally</h4>
              <p className="text-[#9a9a9a] text-[9px] font-mono">Cryptographic proofs ensure tally correctness without exposing votes</p>
            </div>
            <div className="border border-[#2a2a2a] p-4 hover:border-[#ff6b35] transition-colors">
              <h4 className="text-[10px] font-bold font-mono mb-2 text-white">Open-source standards</h4>
              <p className="text-[#9a9a9a] text-[9px] font-mono">Fully auditable codebase following established cryptographic protocols</p>
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses DaoChain */}
      <section id="use-cases" className="py-8 px-6 border-t border-[#2a2a2a] scroll-mt-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-1.5 mb-4">
            <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
            <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">USE CASES</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-mono mb-6 tracking-tight">
            Who Uses DaoChain
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-2 text-white">DAOs running governance</h3>
              <p className="text-[#9a9a9a] text-[10px] font-mono leading-relaxed">
                Decentralized organizations need anonymous voting to prevent voter coercion, 
                bribery, and collusion while maintaining full transparency of results.
              </p>
            </div>
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-2 text-white">Protocols running token-holder votes</h3>
              <p className="text-[#9a9a9a] text-[10px] font-mono leading-relaxed">
                DeFi protocols and blockchain projects requiring secure, private voting 
                for protocol upgrades and parameter changes.
              </p>
            </div>
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-2 text-white">Collectives needing anonymous decisions</h3>
              <p className="text-[#9a9a9a] text-[10px] font-mono leading-relaxed">
                Member-based organizations requiring confidential voting on sensitive 
                matters while proving the legitimacy of results.
              </p>
            </div>
            <div className="border-l-2 border-[#ff6b35] pl-4 py-2">
              <h3 className="text-sm font-bold font-mono mb-2 text-white">Communities running fair elections</h3>
              <p className="text-[#9a9a9a] text-[10px] font-mono leading-relaxed">
                Online communities and social DAOs that need tamper-proof elections 
                without revealing individual member choices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section id="docs" className="py-8 px-6 border-t border-[#2a2a2a] scroll-mt-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-1.5 mb-4">
            <div className="w-1 h-1 bg-[#ff6b35] rounded-full mt-0.5"></div>
            <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">QUICKSTART GUIDE</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-mono mb-6 tracking-tight">
            Built for Developers
          </h2>
          <div className="mb-6">
            <ul className="space-y-2 text-[#9a9a9a] text-[10px] font-mono">
              <li>• JS/TS + Rust SDKs</li>
              <li>• Lightweight client APIs</li>
              <li>• Easy DAO integration</li>
              <li>• Works with multisigs, treasuries, and governance tools</li>
            </ul>
          </div>
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] p-4 font-mono text-[10px] mb-4">
            <div className="space-y-2">
              <div>
                <p className="text-[#6a6a6a] mb-1"># Install dependencies</p>
                <p className="text-[#ff6b35]">pnpm install</p>
              </div>
              <div>
                <p className="text-[#6a6a6a] mb-1"># Start DaoChain node</p>
                <p className="text-[#ff6b35]">./target/release/parachain-template-node --dev</p>
              </div>
              <div>
                <p className="text-[#6a6a6a] mb-1"># Run the pipeline</p>
                <p className="text-[#ff6b35]">npm run run:daochain-pipeline</p>
              </div>
            </div>
          </div>
          <a 
            href="/sandbox" 
            className="inline-block px-5 py-2.5 border border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35] hover:text-black font-mono font-bold text-[9px] uppercase tracking-widest transition-colors"
          >
            TRY SANDBOX →
          </a>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10 px-6 border-t border-[#2a2a2a] relative overflow-hidden">
        <DiagonalTexture />
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold font-mono mb-3 tracking-tight">
            Private voting.<br />
            Public trust.
          </h2>
          <p className="text-sm text-[#9a9a9a] font-mono mb-6">
            Governance that actually scales.
          </p>
          <div className="flex gap-3 justify-center">
            <a 
              href="https://github.com/your-repo/daomix" 
              className="px-5 py-2.5 bg-[#ff6b35] hover:bg-[#e55a2b] text-black font-mono font-bold text-[9px] uppercase tracking-widest transition-colors"
            >
              GITHUB
          </a>
          <a
              href="#docs" 
              className="px-5 py-2.5 border border-[#2a2a2a] hover:border-[#ff6b35] text-[#9a9a9a] hover:text-[#ff6b35] font-mono font-bold text-[9px] uppercase tracking-widest transition-colors"
            >
              DOCUMENTATION
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-[#2a2a2a]">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[9px] font-mono text-[#6a6a6a]">
          <p>© 2024 DAOCHAIN. OPEN SOURCE.</p>
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
