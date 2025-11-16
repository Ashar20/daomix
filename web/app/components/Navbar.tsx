import Link from "next/link";
import DiagonalTexture from "./DiagonalTexture";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[#2a2a2a]">
      <div className="flex items-center justify-between h-10">
        {/* Logo Section */}
        <div className="flex items-center h-full px-6 border-r border-[#2a2a2a] relative overflow-hidden">
          <DiagonalTexture />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center p-0.5">
              <div className="w-full h-full border border-black rounded-sm flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
              </div>
            </div>
            <span className="text-white font-mono font-bold text-xs tracking-wider uppercase">
              DAOCHAIN
            </span>
          </div>
        </div>

        {/* Spacer with Texture */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#1a1a1a]">
          <DiagonalTexture />
        </div>

        {/* Navigation Links */}
        <div className="flex items-center h-full">
          <Link 
            href="#pricing" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-[10px] font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            PRICING
          </Link>
          <Link 
            href="#enterprise" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-[10px] font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            ENTERPRISE
          </Link>
          <Link 
            href="#docs" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-[10px] font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            DOCS
          </Link>
          <Link 
            href="#careers" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-[10px] font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            CAREERS
          </Link>
          <Link 
            href="#news" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-[10px] font-mono tracking-wider border-l border-[#2a2a2a] transition-colors"
          >
            NEWS
          </Link>
          <Link 
            href="#sign-in" 
            className="h-full px-5 flex items-center text-[#9a9a9a] hover:text-[#ff6b35] uppercase text-[10px] font-mono tracking-wider border-l border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors"
          >
            SIGN IN
          </Link>
        </div>
      </div>
    </nav>
  );
}

