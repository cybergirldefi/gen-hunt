export default function Mascot({ size = 120, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none"
         xmlns="http://www.w3.org/2000/svg" style={style}>
      <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1"/>
          <stop offset="100%" stopColor="#22D3EE"/>
        </linearGradient>
        <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow ring */}
      <circle cx="60" cy="60" r="56" fill="url(#glowGrad)" opacity="0.4"/>

      {/* Shield body */}
      <path d="M60 8 L96 24 L96 60 C96 80 80 96 60 108 C40 96 24 80 24 60 L24 24 Z"
            fill="rgba(99,102,241,0.08)" stroke="url(#shieldGrad)" strokeWidth="2"/>

      {/* Inner shield highlight */}
      <path d="M60 18 L88 31 L88 60 C88 76 76 89 60 99 C44 89 32 76 32 60 L32 31 Z"
            fill="rgba(99,102,241,0.05)" stroke="rgba(99,102,241,0.2)" strokeWidth="1"/>

      {/* Target crosshair */}
      <circle cx="60" cy="58" r="18" stroke="url(#shieldGrad)" strokeWidth="1.5" strokeDasharray="3 3"/>
      <circle cx="60" cy="58" r="10" stroke="url(#shieldGrad)" strokeWidth="1.5" filter="url(#glow)"/>
      <circle cx="60" cy="58" r="3" fill="url(#shieldGrad)" filter="url(#glow)"/>

      {/* Crosshair lines */}
      <line x1="60" y1="36" x2="60" y2="44" stroke="url(#shieldGrad)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="60" y1="72" x2="60" y2="80" stroke="url(#shieldGrad)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="38" y1="58" x2="46" y2="58" stroke="url(#shieldGrad)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="74" y1="58" x2="82" y2="58" stroke="url(#shieldGrad)" strokeWidth="1.5" strokeLinecap="round"/>

      {/* Top lock icon suggestion */}
      <rect x="54" y="22" width="12" height="8" rx="2"
            fill="none" stroke="rgba(34,211,238,0.6)" strokeWidth="1.2"/>
      <path d="M56 22 L56 19 Q60 16 64 19 L64 22"
            fill="none" stroke="rgba(34,211,238,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
