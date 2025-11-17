"use client";

import { useState } from "react";

type Platform = "macos" | "linux" | "windows";

const STEPS = [
  {
    id: 1,
    label: "INSTALL DEPENDENCIES",
    title: "Install Dependencies",
    description: "First, install the required packages using pnpm or npm.",
    commands: {
      macos: "pnpm install",
      linux: "pnpm install",
      windows: "pnpm install"
    },
    output: "✓ Dependencies installed successfully"
  },
  {
    id: 2,
    label: "START DAOCHAIN NODE",
    title: "Start DaoChain Node",
    description: "Launch the Substrate-based DaoChain node in development mode.",
    commands: {
      macos: "./target/release/parachain-template-node --dev --ws-port 9944",
      linux: "./target/release/parachain-template-node --dev --ws-port 9944",
      windows: ".\\target\\release\\parachain-template-node.exe --dev --ws-port 9944"
    },
    output: "✓ DaoChain node running on ws://127.0.0.1:9944"
  },
  {
    id: 3,
    label: "START MIX-NODE",
    title: "Start Mix-Node",
    description: "Start at least one mix-node to handle ballot mixing.",
    commands: {
      macos: "npm run dev:mix-node --workspace @polokol/mixer",
      linux: "npm run dev:mix-node --workspace @polokol/mixer",
      windows: "npm run dev:mix-node --workspace @polokol/mixer"
    },
    output: "✓ Mix-node listening on port 9001"
  },
  {
    id: 4,
    label: "RUN PIPELINE",
    title: "Run DaoMix Pipeline",
    description: "Execute the full DaoMix voting pipeline end-to-end.",
    commands: {
      macos: "npm run run:daochain-pipeline --workspace @polokol/mixer",
      linux: "npm run run:daochain-pipeline --workspace @polokol/mixer",
      windows: "npm run run:daochain-pipeline --workspace @polokol/mixer"
    },
    output: "🎯 DaoMix pipeline complete for election 1"
  },
  {
    id: 5,
    label: "VERIFY RESULTS",
    title: "Verify Results",
    description: "Check the on-chain tally and verify election integrity.",
    commands: {
      macos: "npm run verify:election --workspace @polokol/mixer",
      linux: "npm run verify:election --workspace @polokol/mixer",
      windows: "npm run verify:election --workspace @polokol/mixer"
    },
    output: "✓ Election results verified on-chain"
  },
];

export default function Sandbox() {
  const [currentStep, setCurrentStep] = useState(0);
  const [platform, setPlatform] = useState<Platform>("macos");
  const [copied, setCopied] = useState(false);

  const handleNextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (index: number) => {
    setCurrentStep(index);
  };

  const handleCopyCommand = async () => {
    const command = step.commands[platform];
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePlatformChange = (newPlatform: Platform) => {
    setPlatform(newPlatform);
  };

  const step = STEPS[currentStep];
  const currentCommand = step.commands[platform];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Left Sidebar Navigation */}
      <div className="fixed left-0 top-0 bottom-0 w-20 border-r border-[#2a2a2a] bg-black z-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
          {/* Progress Dots */}
          {STEPS.map((s, index) => (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <button
                onClick={() => handleStepClick(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-[#ff6b35] ring-4 ring-[#ff6b35] ring-opacity-20'
                    : index < currentStep
                    ? 'bg-[#ff6b35] opacity-60'
                    : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                }`}
                title={s.label}
              />
              <span className="text-[8px] font-mono text-[#6a6a6a]">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>
        
        {/* Bottom Step Counter */}
        <div className="p-4 border-t border-[#2a2a2a] text-center">
          <div className="text-[8px] font-mono text-[#6a6a6a] uppercase tracking-widest">
            STEP
          </div>
          <div className="text-lg font-mono font-bold text-[#ff6b35]">
            {String(currentStep + 1).padStart(2, '0')}
          </div>
          <div className="text-[8px] font-mono text-[#6a6a6a]">
            OF {String(STEPS.length).padStart(2, '0')}
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
            <div className="relative z-10 p-12 flex flex-col h-screen justify-between">
              <div>
                {/* Step Header */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-[#ff6b35] rounded-full animate-pulse"></div>
                    <span className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono">
                      STEP {String(currentStep + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
                    </span>
                  </div>
                  <h1 className="text-5xl font-bold font-mono leading-tight mb-6">
                    {step.title}
                  </h1>
                  <p className="text-[#9a9a9a] text-sm font-mono leading-relaxed mb-6">
                    {step.description}
                  </p>
                </div>

                {/* Terminal Command Box */}
                <div className="mb-8 border border-[#2a2a2a] bg-[#0a0a0a]">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#ff6b35]"></div>
                      <span className="text-[9px] font-mono text-[#9a9a9a]">{String(currentStep + 1).padStart(2, '0')} - TERMINAL / IDE</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3 text-[10px] font-mono">
                      <button
                        onClick={() => handlePlatformChange("macos")}
                        className={`px-2 py-0.5 transition-colors ${
                          platform === "macos"
                            ? "text-[#ff6b35] border-b border-[#ff6b35]"
                            : "text-[#6a6a6a] hover:text-[#9a9a9a]"
                        }`}
                      >
                        MACOS
                      </button>
                      <span className="text-[#6a6a6a]">/</span>
                      <button
                        onClick={() => handlePlatformChange("linux")}
                        className={`px-2 py-0.5 transition-colors ${
                          platform === "linux"
                            ? "text-[#ff6b35] border-b border-[#ff6b35]"
                            : "text-[#6a6a6a] hover:text-[#9a9a9a]"
                        }`}
                      >
                        LINUX
                      </button>
                      <span className="text-[#6a6a6a] border border-[#2a2a2a] px-2 py-0.5">
                        <button
                          onClick={() => handlePlatformChange("windows")}
                          className={`transition-colors ${
                            platform === "windows"
                              ? "text-[#ff6b35]"
                              : "text-[#6a6a6a] hover:text-[#9a9a9a]"
                          }`}
                        >
                          WINDOWS
                        </button>
                      </span>
                    </div>
                    <div className="bg-black border border-[#2a2a2a] p-3 rounded flex items-center justify-between group hover:border-[#ff6b35] transition-colors">
                      <div className="flex items-center gap-2 flex-1 overflow-hidden">
                        <span className="text-[#ff6b35] text-[10px] font-mono">{'>'}</span>
                        <span className="text-[#9a9a9a] text-[10px] font-mono truncate">{currentCommand}</span>
                      </div>
                      <button
                        onClick={handleCopyCommand}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0 relative"
                        title="Copy to clipboard"
                      >
                        {copied ? (
                          <svg className="w-4 h-4 text-[#4ade80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-[#9a9a9a] hover:text-[#ff6b35] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expected Output */}
                <div className="mb-8">
                  <div className="text-[9px] uppercase tracking-widest text-[#9a9a9a] font-mono mb-2">
                    EXPECTED OUTPUT
                  </div>
                  <div className="bg-black border border-[#2a2a2a] p-4 font-mono text-[10px]">
                    <p className="text-[#4ade80]">{step.output}</p>
                  </div>
                </div>

                {/* Quick Tip */}
                <div className="border-l-2 border-[#ff6b35] pl-4">
                  <div className="text-[9px] uppercase tracking-widest text-[#ff6b35] font-mono mb-2">
                    TIP
                  </div>
                  <p className="text-[#9a9a9a] text-[10px] font-mono leading-relaxed">
                    {currentStep === 0 && "Make sure you have Node.js 20+ and pnpm installed before running this command."}
                    {currentStep === 1 && "The node must be running before you can start the mix-node or execute the pipeline."}
                    {currentStep === 2 && "You can run multiple mix-nodes on different ports for better anonymity."}
                    {currentStep === 3 && "Make sure to configure environment variables for voter seeds and election parameters."}
                    {currentStep === 4 && "Check the chain state to verify that tally results are committed on-chain."}
                  </p>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-6">
                <button
                  onClick={handlePrevStep}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-2 px-4 py-2 border text-[10px] font-mono uppercase tracking-widest transition-colors ${
                    currentStep === 0
                      ? 'border-[#2a2a2a] text-[#6a6a6a] cursor-not-allowed'
                      : 'border-[#2a2a2a] text-white hover:border-[#ff6b35] hover:text-[#ff6b35]'
                  }`}
                >
                  ← PREVIOUS
                </button>
                <div className="text-[10px] font-mono text-[#6a6a6a]">
                  {currentStep + 1} OF {STEPS.length}
                </div>
                <button
                  onClick={handleNextStep}
                  disabled={currentStep === STEPS.length - 1}
                  className={`flex items-center gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${
                    currentStep === STEPS.length - 1
                      ? 'bg-[#ff6b35] text-black cursor-default'
                      : 'bg-[#ff6b35] hover:bg-[#e55a2b] text-black'
                  }`}
                >
                  {currentStep === STEPS.length - 1 ? 'COMPLETE ✓' : 'NEXT →'}
                </button>
              </div>
            </div>
          </div>

          {/* Right IDE Section */}
          <div className="w-1/2 bg-black sticky top-0 h-screen flex flex-col">
            {/* Top Label */}
            <div className="absolute top-4 right-4 text-[9px] font-mono text-[#6a6a6a] uppercase tracking-widest">
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
                  <span className="text-[9px] font-mono text-[#6a6a6a]">orchestrator.ts - daomix</span>
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#6a6a6a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                  </div>
                </div>

                {/* Sidebar + Editor */}
                <div className="flex h-96">
                  {/* File Explorer */}
                  <div className="w-48 border-r border-[#2a2a2a] bg-[#0a0a0a] p-3">
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2 text-[9px] font-mono text-[#9a9a9a] uppercase">
                        <span>▼</span>
                        <span className="text-white font-bold">EXPLORER</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-[9px] font-mono">
                      <div className="flex items-center gap-2 text-[#9a9a9a] hover:text-white cursor-pointer">
                        <span>▼</span>
                        <span className="text-[#ff6b35]">DAOMIX</span>
                      </div>
                      <div className="ml-4 space-y-1">
                        <div className="flex items-center gap-2 text-[#9a9a9a] hover:text-white cursor-pointer">
                          <span>▶</span>
                          <span>contracts/</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#9a9a9a] hover:text-white cursor-pointer">
                          <span>▶</span>
                          <span>mixer/</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#9a9a9a] hover:text-white cursor-pointer">
                          <span>▶</span>
                          <span>sdk/</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#9a9a9a] hover:text-white cursor-pointer">
                          <span>▶</span>
                          <span>polokol-chain/</span>
                        </div>
                        <div className="flex items-center gap-2 text-white">
                          <span>📄</span>
                          <span>package.json</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Terminal Output */}
                  <div className="flex-1 bg-black p-4 font-mono text-[9px] overflow-auto">
                    <div className="mb-3 text-[#6a6a6a]">TERMINAL OUTPUT</div>
                    <div className="space-y-1">
                      <div className="flex">
                        <span className="text-[#ff6b35]">$</span>
                        <span className="text-white ml-2">{currentCommand}</span>
                      </div>
                      <div className="text-[#6a6a6a] mt-2">
                        # Running step {currentStep + 1} of {STEPS.length}...
                      </div>
                      {currentStep >= 0 && (
                        <div className="text-[#4ade80] mt-1">
                          ✓ {STEPS[0].output}
                        </div>
                      )}
                      {currentStep >= 1 && (
                        <div className="text-[#4ade80] mt-1">
                          ✓ {STEPS[1].output}
                        </div>
                      )}
                      {currentStep >= 2 && (
                        <div className="text-[#4ade80] mt-1">
                          ✓ {STEPS[2].output}
                        </div>
                      )}
                      {currentStep >= 3 && (
                        <div className="text-[#4ade80] mt-1">
                          ✓ {STEPS[3].output}
                        </div>
                      )}
                      {currentStep >= 4 && (
                        <div className="text-[#ff6b35] mt-2">
                          {STEPS[4].output}
                        </div>
                      )}
                      <div className="text-[#6a6a6a] mt-3">
                        {currentStep < STEPS.length - 1 ? '# Waiting for next step...' : '# All steps completed successfully!'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Label */}
            <div className="absolute bottom-8 right-8 text-[9px] font-mono text-[#6a6a6a] uppercase tracking-widest">
              IDE
            </div>
            <div className="absolute bottom-8 left-8 text-sm font-mono text-[#6a6a6a]">
              Step {currentStep + 1}: {step.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

