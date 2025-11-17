import Link from "next/link";
import DiagonalTexture from "./DiagonalTexture";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[#2a2a2a]">
      <div className="flex items-center justify-between h-10">
        {/* Logo Section */}
        <Link href="/" className="flex items-center h-full px-6 border-r border-[#2a2a2a] relative overflow-hidden hover:opacity-80 transition-opacity">
          <DiagonalTexture />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center p-0.5">
              <div className="w-full h-full border border-black rounded-sm flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
              </div>
            </div>
            <span className="text-white font-mono font-bold text-sm tracking-wider uppercase">
              DAOCHAIN
            </span>
          </div>
        </Link>

        {/* Spacer with Texture */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#1a1a1a]">
          <DiagonalTexture />
        </div>

        {/* Navigation Links */}
        <div className="flex items-center h-full">
          <Link 
            href="#features" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-xs font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            FEATURES
          </Link>
          <Link 
            href="#how-it-works" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-xs font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            HOW IT WORKS
          </Link>
          <Link 
            href="#architecture" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-xs font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            ARCHITECTURE
          </Link>
          <Link 
            href="#use-cases" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-xs font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            USE CASES
          </Link>
          <Link 
            href="#docs" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-xs font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            DOCS
          </Link>
          <Link 
            href="/sandbox" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-xs font-mono tracking-wider border-l border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors btn-animated-texture btn-text-orange"
          >
            SANDBOX
          </Link>
        </div>
      </div>
    </nav>
  );
}

