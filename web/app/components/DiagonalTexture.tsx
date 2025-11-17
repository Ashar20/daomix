export default function DiagonalTexture() {
  return (
    <div 
      className="absolute inset-0 opacity-15"
      style={{
        backgroundImage: `repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 6px,
          rgba(255, 255, 255, 0.8) 6px,
          rgba(255, 255, 255, 0.6) 7px
        )`
      }}
    />
  );
}

