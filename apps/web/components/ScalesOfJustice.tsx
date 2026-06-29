"use client";

interface Props {
  size?: number;
  className?: string;
  animate?: boolean;
  glow?: boolean;
}

export function ScalesOfJustice({ size = 120, className = "", animate = true, glow = true }: Props) {
  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size * 0.95 }}>
      {glow && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 50% 40%, rgba(201,168,76,0.2) 0%, transparent 65%)",
            filter: "blur(18px)",
            animation: "pulse-glow 3s ease-in-out infinite",
          }}
        />
      )}
      <svg
        width={size}
        height={size * 0.95}
        viewBox="0 0 120 114"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gold-h" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#8a6f2a" />
            <stop offset="45%"  stopColor="#e8c96a" />
            <stop offset="100%" stopColor="#8a6f2a" />
          </linearGradient>
          <linearGradient id="gold-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#c9a84c" />
            <stop offset="100%" stopColor="#8a6f2a" />
          </linearGradient>
          <filter id="gold-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Pole */}
        <line x1="60" y1="108" x2="60" y2="24" stroke="url(#gold-v)" strokeWidth="2" strokeLinecap="round" />

        {/* Base platform */}
        <rect x="36" y="104" width="48" height="4" rx="2" fill="url(#gold-h)" opacity="0.9" />
        <rect x="42" y="100" width="36" height="4" rx="2" fill="url(#gold-h)" opacity="0.6" />

        {/* Crown / top finial */}
        <circle cx="60" cy="14" r="6" fill="none" stroke="url(#gold-h)" strokeWidth="1.5" filter="url(#gold-glow)" />
        <circle cx="60" cy="14" r="2.5" fill="#c9a84c" filter="url(#gold-glow)" />

        {/* Pivot */}
        <circle cx="60" cy="26" r="3.5" fill="#c9a84c" filter="url(#gold-glow)" />

        {/* Animated beam + pans */}
        <g
          style={{
            transformOrigin: "60px 26px",
            animation: animate ? "scales-swing 4s ease-in-out infinite" : undefined,
          }}
        >
          {/* Beam */}
          <line x1="14" y1="26" x2="106" y2="26" stroke="url(#gold-h)" strokeWidth="2" strokeLinecap="round" />

          {/* Left chain (dashed) */}
          <line x1="20" y1="26" x2="20" y2="64"
            stroke="#c9a84c" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" strokeLinecap="round" />
          {/* Left pan */}
          <ellipse cx="20" cy="68" rx="20" ry="5.5"
            fill="rgba(201,168,76,0.06)" stroke="url(#gold-h)" strokeWidth="1.5" filter="url(#gold-glow)" />
          {/* Left pan curve */}
          <path d="M 1 68 Q 20 80 39 68" fill="none" stroke="url(#gold-h)" strokeWidth="1.2" opacity="0.5" />
          {/* Left pan shine dot */}
          <circle cx="14" cy="67" r="1.5" fill="rgba(240,216,120,0.4)" />

          {/* Right chain (dashed) */}
          <line x1="100" y1="26" x2="100" y2="56"
            stroke="#c9a84c" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" strokeLinecap="round" />
          {/* Right pan */}
          <ellipse cx="100" cy="60" rx="20" ry="5.5"
            fill="rgba(201,168,76,0.06)" stroke="url(#gold-h)" strokeWidth="1.5" filter="url(#gold-glow)" />
          {/* Right pan curve */}
          <path d="M 81 60 Q 100 72 119 60" fill="none" stroke="url(#gold-h)" strokeWidth="1.2" opacity="0.5" />
          {/* Right pan shine dot */}
          <circle cx="94" cy="59" r="1.5" fill="rgba(240,216,120,0.4)" />
        </g>
      </svg>
    </div>
  );
}
