import { LEVELS, sh } from '../lib/config.js'

export default function Leaderboard({ player, account }) {
  return (
    <div style={{ maxWidth:640, margin:'0 auto' }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'JetBrains Mono',
          marginBottom:8, letterSpacing:'0.5px' }}>LEADERBOARD</div>
        <h2 style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px' }}>Top Hunters</h2>
        <p style={{ color:'var(--text2)', marginTop:8, fontSize:14 }}>
          Rankings update on-chain after each completed level.
        </p>
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text2)' }}>
          <div style={{ width:48,height:48, borderRadius:12, background:'rgba(99,102,241,0.06)',
            border:'1px solid rgba(99,102,241,0.12)', margin:'0 auto 16px',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'JetBrains Mono', fontWeight:700, color:'var(--indigo)' }}>—</div>
          <div style={{ fontFamily:'JetBrains Mono', fontSize:14 }}>
            Leaderboard populates as players complete levels.
          </div>
          <div style={{ fontSize:13, marginTop:6 }}>
            Be the first to reach Level 5 — Elite.
          </div>
        </div>
      </div>

      {player && (
        <div className="card" style={{ borderColor:'rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'JetBrains Mono',
            marginBottom:12, letterSpacing:'0.5px' }}>YOUR STATS</div>
          <div className="lb-row me">
            <div style={{ width:28,height:28, borderRadius:7,
              background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'JetBrains Mono', fontWeight:700, fontSize:12,
              color:'var(--indigo)', flexShrink:0 }}>
              {player.level||1}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'JetBrains Mono', fontWeight:700 }}>
                {player.username || sh(account)}
              </div>
              <div style={{ fontSize:11, color:'var(--text2)' }}>
                Level {player.level} — {LEVELS[String(player.level||1)]?.name}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, color:'#A5B4FC' }}>
                {(player.xp||0).toLocaleString()} XP
              </div>
              <div style={{ fontSize:11, color:'var(--text2)' }}>
                {player.total_correct||0} correct · {player.best_streak||0} best streak
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
