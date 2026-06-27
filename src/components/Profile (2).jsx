import { LEVELS, LEVEL_XP_THRESHOLD, sh } from '../lib/config.js'

export default function Profile({ account, player, setView }) {
  if (!player) return null
  const level  = player.level || 1
  const xp     = player.xp || 0
  const nextXP = LEVEL_XP_THRESHOLD[String(level + 1)]
  const curXP  = LEVEL_XP_THRESHOLD[String(level)] || 0
  const prog   = nextXP ? Math.min(100, ((xp - curXP) / (nextXP - curXP)) * 100) : 100

  return (
    <div style={{ maxWidth:560, margin:'0 auto' }}>
      <button className="btn btn-ghost" style={{ marginBottom:24 }} onClick={() => setView('home')}>
        Back
      </button>

      <div className="card card-indigo" style={{ marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ width:56,height:56, borderRadius:14,
            background:`${LEVELS[String(level)]?.color}12`,
            border:`1px solid ${LEVELS[String(level)]?.color}30`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'JetBrains Mono', fontWeight:800, fontSize:20,
            color: LEVELS[String(level)]?.color }}>
            {level}
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-0.3px' }}>
              {player.username || sh(account)}
            </div>
            <div style={{ marginTop:6 }}>
              <span className={`pill level-${level}`}>
                Level {level} — {LEVELS[String(level)]?.name}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11,
            color:'var(--text2)', fontFamily:'JetBrains Mono', marginBottom:6 }}>
            <span>{xp.toLocaleString()} XP</span>
            <span>{level < 5 ? `${nextXP?.toLocaleString()} to Level ${level+1}` : 'Max Level'}</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width:`${prog}%` }} />
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:20 }}>
          {[
            [player.total_correct||0,  'Correct'],
            [player.total_answered||0, 'Answered'],
            [player.best_streak||0,    'Best Streak'],
            [player.hunt_played||0,    'Hunts'],
            [player.hunt_wins||0,      'Hunt Wins'],
            [(player.levels_completed||[]).length, 'Levels Done'],
          ].map(([val, label]) => (
            <div key={label} style={{ background:'rgba(255,255,255,0.03)',
              borderRadius:10, padding:'12px 14px',
              border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:800, fontFamily:'JetBrains Mono',
                color:'#A5B4FC', marginBottom:4 }}>{val}</div>
              <div style={{ fontSize:11, color:'var(--text2)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'JetBrains Mono',
          marginBottom:14, letterSpacing:'0.5px' }}>LEVEL PROGRESS</div>
        {['1','2','3','4','5'].map((l,i) => {
          const done   = (player.levels_completed||[]).includes(l)
          const locked = parseInt(l) > (player.level||1) && !done
          return (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:12,
              padding:'12px 0',
              borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width:28,height:28, borderRadius:7, flexShrink:0,
                background: done ? `${LEVELS[l].color}15` : 'rgba(255,255,255,0.03)',
                border:`1px solid ${done ? LEVELS[l].color+'40' : 'rgba(255,255,255,0.07)'}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontFamily:'JetBrains Mono', fontWeight:700,
                color: done ? LEVELS[l].color : 'var(--text2)' }}>
                {done ? '✓' : l}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>
                  Level {l} — {LEVELS[l].name}
                </div>
                <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>
                  {LEVELS[l].topic}
                </div>
              </div>
              <span style={{ fontSize:12, fontFamily:'JetBrains Mono',
                color: done ? 'var(--green)' : locked ? 'var(--text2)' : LEVELS[l].color }}>
                {done ? 'Complete' : locked ? 'Locked' : 'In Progress'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
