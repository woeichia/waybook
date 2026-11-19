import React from 'react';

export const PaperGrainOverlay: React.FC = () => {
  return (
    <svg
      aria-hidden="true"
      className="fixed inset-0 h-full w-full pointer-events-none z-[90] opacity-35 mix-blend-multiply"
    >
      <filter id="waybook-paper-grain" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.78"
          numOctaves={3}
          stitchTiles="stitch"
          result="noise"
        />
        <feColorMatrix type="saturate" values="0" in="noise" result="monoNoise" />
        <feComponentTransfer in="monoNoise" result="softGrain">
          <feFuncA type="linear" slope="0.18" />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter="url(#waybook-paper-grain)" />
    </svg>
  );
};
