// Mochi — GenLayer's mascot, adapted for GenHunt
export default function Mascot({ size = 120, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none"
         xmlns="http://www.w3.org/2000/svg" style={style}>
      <defs>
        <linearGradient id="mochiBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1"/>
          <stop offset="100%" stopColor="#4F46E5"/>
        </linearGradient>
        <linearGradient id="mochiSuit" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E1B4B"/>
          <stop offset="100%" stopColor="#1A1035"/>
        </linearGradient>
        <linearGradient id="mochiVisor" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#0891B2" stopOpacity="0.7"/>
        </linearGradient>
        <filter id="mochiGlow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Body / suit */}
      <ellipse cx="80" cy="118" rx="34" ry="28" fill="url(#mochiSuit)"
               stroke="rgba(99,102,241,0.4)" strokeWidth="1.5"/>

      {/* Suit collar / neck */}
      <rect x="66" y="100" width="28" height="14" rx="4" fill="url(#mochiSuit)"
            stroke="rgba(99,102,241,0.3)" strokeWidth="1"/>

      {/* Chest hex plate */}
      <polygon points="80,107 87,111 87,119 80,123 73,119 73,111"
               fill="rgba(99,102,241,0.15)" stroke="rgba(34,211,238,0.6)" strokeWidth="1.2"/>
      <circle cx="80" cy="115" r="3" fill="rgba(34,211,238,0.8)" filter="url(#mochiGlow)"/>

      {/* Arms */}
      <ellipse cx="48" cy="114" rx="10" ry="7" fill="url(#mochiSuit)"
               stroke="rgba(99,102,241,0.3)" strokeWidth="1" transform="rotate(-20 48 114)"/>
      <ellipse cx="112" cy="114" rx="10" ry="7" fill="url(#mochiSuit)"
               stroke="rgba(99,102,241,0.3)" strokeWidth="1" transform="rotate(20 112 114)"/>

      {/* Head */}
      <ellipse cx="80" cy="74" rx="36" ry="34" fill="url(#mochiBody)"/>

      {/* Ears — cat style */}
      <polygon points="50,52 44,34 60,46" fill="url(#mochiBody)"/>
      <polygon points="52,50 47,37 60,46" fill="rgba(139,92,246,0.6)"/>
      <polygon points="110,52 116,34 100,46" fill="url(#mochiBody)"/>
      <polygon points="108,50 113,37 100,46" fill="rgba(139,92,246,0.6)"/>

      {/* Visor / face plate */}
      <rect x="54" y="62" width="52" height="28" rx="14"
            fill="url(#mochiVisor)" opacity="0.85"/>
      <rect x="54" y="62" width="52" height="28" rx="14"
            fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="1"/>

      {/* Eyes */}
      <circle cx="68" cy="76" r="8" fill="rgba(7,9,15,0.9)"/>
      <circle cx="92" cy="76" r="8" fill="rgba(7,9,15,0.9)"/>
      {/* Eye shine */}
      <circle cx="68" cy="76" r="5" fill="rgba(34,211,238,0.9)" filter="url(#mochiGlow)"/>
      <circle cx="92" cy="76" r="5" fill="rgba(34,211,238,0.9)" filter="url(#mochiGlow)"/>
      <circle cx="70" cy="74" r="2" fill="white" opacity="0.9"/>
      <circle cx="94" cy="74" r="2" fill="white" opacity="0.9"/>

      {/* Antenna */}
      <line x1="80" y1="40" x2="80" y2="52" stroke="rgba(99,102,241,0.7)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="80" cy="38" r="4" fill="rgba(99,102,241,0.5)"
              stroke="rgba(34,211,238,0.8)" strokeWidth="1.5" filter="url(#mochiGlow)"/>

      {/* Feet */}
      <ellipse cx="66" cy="141" rx="11" ry="6" fill="url(#mochiSuit)"
               stroke="rgba(99,102,241,0.3)" strokeWidth="1"/>
      <ellipse cx="94" cy="141" rx="11" ry="6" fill="url(#mochiSuit)"
               stroke="rgba(99,102,241,0.3)" strokeWidth="1"/>
    </svg>
  )
}
