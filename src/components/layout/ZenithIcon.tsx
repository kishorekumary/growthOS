export default function ZenithIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="zenith-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3730a3" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id="zenith-peak" x1="20" y1="8" x2="20" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.65" />
        </linearGradient>
        <filter id="zenith-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="40" height="40" rx="11" fill="url(#zenith-bg)" />

      {/* Subtle inner glow at top */}
      <ellipse cx="20" cy="6" rx="14" ry="6" fill="rgba(165,180,252,0.12)" />

      {/* Mountain peak — outer */}
      <path
        d="M8 31 L20 11 L32 31"
        stroke="url(#zenith-peak)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Mountain peak — inner ridge (depth) */}
      <path
        d="M14.5 26 L20 14.5 L25.5 26"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.3"
      />

      {/* Zenith dot — gold at the peak */}
      <circle cx="20" cy="10" r="3" fill="#fbbf24" filter="url(#zenith-glow)" />
      <circle cx="20" cy="10" r="1.8" fill="#fde68a" />
    </svg>
  )
}
