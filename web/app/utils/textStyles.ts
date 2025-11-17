// Reusable text style classes for consistent typography across the app

export const textStyles = {
  // Headings
  h1: "text-5xl md:text-7xl font-bold font-mono leading-tight tracking-tight",
  h2: "text-4xl md:text-5xl font-bold font-mono tracking-tight",
  h3: "text-3xl font-bold font-mono tracking-tight",
  h4: "text-xl font-bold font-mono",
  h5: "text-base font-bold font-mono",
  h6: "text-sm font-bold font-mono",

  // Body text
  body: "text-base text-[#9a9a9a] font-mono leading-relaxed",
  bodySmall: "text-sm text-[#9a9a9a] font-mono leading-relaxed",
  bodyTiny: "text-xs text-[#9a9a9a] font-mono leading-relaxed",

  // Labels & captions
  label: "text-[11px] uppercase tracking-widest text-[#9a9a9a] font-mono",
  caption: "text-[11px] text-[#6a6a6a] font-mono",

  // Accent text
  accent: "text-[#ff6b35]",
  accentBold: "text-[#ff6b35] font-bold",

  // Code/terminal text
  code: "text-xs font-mono",
  terminal: "text-[10px] font-mono",

  // Buttons
  buttonPrimary: "px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors btn-animated-texture btn-orange-border border bg-[#ff6b35] hover:bg-[#e55a2b] text-black border-[#ff6b35]",
  buttonSecondary: "px-4 py-2 border text-xs font-mono uppercase tracking-widest transition-colors border-[#2a2a2a] text-white hover:border-[#ff6b35] hover:text-[#ff6b35] btn-animated-texture",

  // Links
  link: "text-[#9a9a9a] hover:text-[#ff6b35] transition-colors",
  linkOrange: "text-[#ff6b35] hover:text-[#e55a2b] transition-colors",
} as const;

// Utility function to combine styles
export const cx = (...classes: (string | undefined | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

