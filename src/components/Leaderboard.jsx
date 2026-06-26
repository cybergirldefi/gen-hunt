import { LEVELS, sh } from '../lib/config.js'

export default function Leaderboard({ player, account }) {
  return (
    <div style={{ maxWidth:640, margin:'0 auto' }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:8 }}>LEADERBOARD</div>
        <h2 style={{ fontSize:28, fontWeight:800, fontFamily:'JetBrains Mono' }}>🏆 Top Hunters</h2>
        <p style={{ color:'var(--muted)', marginTop:8 }}>Rankings are updated on-chain after each session.</p>
      </div>

      <div className="card">
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📡</div>
          <div style={{ fontFamily:'JetBrains Mono', fontSize:14 }}>
            Leaderboard populates as players complete levels.
          </div>
          <div style={{ fontSize:12, marginTop:8 }}>
            Be the first to reach Level 5 — Elite.
          </div>
        </div>
      </div>

      {player && (
        <div className="card" style={{ marginTop:16, borderColor:'rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:12 }}>YOUR RANK</div>
          <div className="lb-row me">
            <span style={{ fontSize:18 }}>⚡</span>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'JetBrains Mono', fontWeight:700 }}>{player.username || sh(account)}</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>
                Level {player.level} — {LEVELS[String(player.level)]?.name}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, color:'#A5B4FC' }}>
                {(player.xp||0).toLocaleString()} XP
              </div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>
                {player.total_correct||0} correct · {player.best_streak||0}🔥 best streak
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
