import { LEVELS, LEVEL_XP_THRESHOLD, sh } from '../lib/config.js'

export function Profile({ account, player, setView }) {
  if (!player) return null
  const level  = player.level || 1
  const xp     = player.xp || 0
  const nextXP = LEVEL_XP_THRESHOLD[String(level + 1)]
  const curXP  = LEVEL_XP_THRESHOLD[String(level)] || 0
  const prog   = nextXP ? Math.min(100, ((xp - curXP) / (nextXP - curXP)) * 100) : 100

  return (
    <div style={{ maxWidth:560, margin:'0 auto' }}>
      <button className="btn btn-outline" style={{ marginBottom:24 }} onClick={() => setView('home')}>← Back</button>

      {/* Profile card */}
      <div className="card card-glow" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ width:64, height:64, borderRadius:16, background:`${LEVELS[String(level)]?.color}20`,
            border:`2px solid ${LEVELS[String(level)]?.color}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:28, fontFamily:'JetBrains Mono' }}>
            {['🔰','🕵','🔍','🛡','💀'][level-1]}
          </div>
          <div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:'JetBrains Mono' }}>
              {player.username || sh(account)}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <span className={`pill level-${level}`} style={{ border:'1px solid' }}>
                Level {level} — {LEVELS[String(level)]?.name}
              </span>
            </div>
          </div>
        </div>

        {/* XP Progress */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12,
            color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:6 }}>
            <span>{xp.toLocaleString()} XP</span>
            <span>{level < 5 ? `${nextXP?.toLocaleString()} XP to Level ${level+1}` : 'MAX LEVEL'}</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width:`${prog}%` }} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            ['🎯', player.total_correct || 0,  'Correct'],
            ['📝', player.total_answered || 0, 'Answered'],
            ['🔥', player.best_streak || 0,    'Best Streak'],
            ['⚔', player.hunt_played || 0,    'Hunts Played'],
            ['🏆', player.hunt_wins || 0,      'Hunt Wins'],
            ['✅', (player.levels_completed || []).length, 'Levels Done'],
          ].map(([icon, val, label]) => (
            <div key={label} style={{ background:'var(--bg3)', borderRadius:10, padding:'12px',
              border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:'JetBrains Mono', color:'#A5B4FC' }}>{val}</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Levels completed */}
      <div className="card">
        <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:12 }}>LEVELS</div>
        {['1','2','3','4','5'].map(l => {
          const done   = (player.levels_completed || []).includes(l)
          const locked = parseInt(l) > (player.level || 1) && !done
          return (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0',
              borderBottom: l!=='5' ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize:20 }}>{done ? '✅' : locked ? '🔒' : '⏳'}</span>
              <div style={{ flex:1 }}>
                <span style={{ fontWeight:600 }}>Level {l} — {LEVELS[l].name}</span>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{LEVELS[l].topic}</div>
              </div>
              {done && <span style={{ fontSize:11, color:'var(--green)', fontFamily:'JetBrains Mono' }}>COMPLETE</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Profile
