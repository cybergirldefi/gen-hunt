import { LEVELS, LEVEL_XP_THRESHOLD, sh } from '../lib/config.js'
import { LevelIcon, StatIcon } from '../App.jsx'

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
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <LevelIcon level={level} size={56} active/>
          <div>
            <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-0.3px' }}>
              {player.username || sh(account)}
            </div>
            <div style={{ marginTop:6 }}>
              <span className={`pill level-${Math.min(level,5)}`}>
                Level {level} — {LEVELS[String(level)]?.name}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11,
            color:'var(--text2)', fontFamily:'JetBrains Mono', marginBottom:6 }}>
            <span>{xp.toLocaleString()} XP</span>
            <span>{level < 8 ? `${nextXP?.toLocaleString()} to Level ${level+1}` : 'Max Level'}</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width:`${prog}%` }} />
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:20 }}>
          {[
            ['correct',   player.total_correct||0,  'Correct'],
            ['streak',    player.best_streak||0,     'Best Streak'],
            ['xp',        (player.levels_completed||[]).length+'/8', 'Levels Done'],
            ['correct',   player.total_answered||0,  'Answered'],
            ['streak',    player.streak||0,           'Streak'],
            ['wins',      xp.toLocaleString(),        'Total XP'],
          ].map(([icon, val, label]) => (
            <div key={label} style={{ background:'rgba(255,255,255,0.03)',
              borderRadius:10, padding:'12px 14px',
              border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
              <StatIcon type={icon} size={16}/>
              <div style={{ fontSize:18, fontWeight:800, fontFamily:'JetBrains Mono',
                color:'#A5B4FC', margin:'6px 0 3px' }}>{val}</div>
              <div style={{ fontSize:10, color:'var(--text2)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'JetBrains Mono',
          marginBottom:14, letterSpacing:'0.5px' }}>LEVEL PROGRESS</div>
        {Object.entries(LEVELS).map(([l, lvl], i) => {
          const done   = (player.levels_completed||[]).includes(l)
          const locked = parseInt(l) > (player.level||1) && !done
          const cur    = String(player.level||1) === l && !done
          return (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:12,
              padding:'10px 0',
              borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <LevelIcon level={parseInt(l)} size={32} done={done} active={cur} locked={locked}/>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>Level {l} — {lvl.name}</div>
                <div style={{ fontSize:11, color:'var(--text2)', marginTop:1 }}>{lvl.topic}</div>
              </div>
              <span style={{ fontSize:11, fontFamily:'JetBrains Mono',
                color: done ? 'var(--green)' : locked ? 'rgba(100,116,139,0.5)' : lvl.color }}>
                {done ? 'Complete' : locked ? 'Locked' : 'In Progress'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
