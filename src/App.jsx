import React, { useState, useEffect, useCallback } from 'react'
import { readContract, writeContract, waitTx, switchToBradbury } from './lib/gl.js'
import { CONTRACT_ADDR, sh, LEVELS, LEVEL_XP_THRESHOLD } from './lib/config.js'
import SoloMode    from './components/SoloMode.jsx'
import Profile     from './components/Profile.jsx'
import Leaderboard from './components/Leaderboard.jsx'
import Mascot      from './components/Mascot.jsx'

// ── Level ring icon ───────────────────────────────────────────────────────
export function LevelIcon({ level, size=32, done, locked, active }) {
  const lvl   = LEVELS[String(level)] || LEVELS['1']
  const color = locked ? 'rgba(100,116,139,0.4)' : lvl.color
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ flexShrink:0 }}>
      <circle cx="16" cy="16" r="13" fill="none"
        stroke={color} strokeWidth={active ? 2.5 : 1.5}
        strokeDasharray={done ? 'none' : '3 2'} opacity={locked ? 0.4 : 1}/>
      {done && <circle cx="16" cy="16" r="9" fill={color} opacity="0.15"/>}
      {active && <circle cx="16" cy="16" r="5" fill={color} opacity="0.35"
        style={{ animation:'pulse 2s ease infinite' }}/>}
      <text x="16" y="20" textAnchor="middle" fontSize="10"
        fontFamily="JetBrains Mono" fontWeight="700"
        fill={locked ? 'rgba(100,116,139,0.5)' : color}>
        {done ? '✓' : String(level)}
      </text>
    </svg>
  )
}

// ── Score ring ────────────────────────────────────────────────────────────
export function ScoreRing({ score, total, color='#6366F1', size=100 }) {
  const pct = total > 0 ? score / total : 0
  const r   = 40
  const circ= 2 * Math.PI * r
  const dash= pct * circ
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transform:'rotate(-90deg)', transformOrigin:'center',
          transition:'stroke-dasharray .8s cubic-bezier(.4,0,.2,1)' }}/>
      <text x="50" y="46" textAnchor="middle" fontSize="18"
        fontFamily="JetBrains Mono" fontWeight="800" fill="white">{score}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="10"
        fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.4)">of {total}</text>
    </svg>
  )
}

// ── Stat icon ─────────────────────────────────────────────────────────────
export function StatIcon({ type, size=20 }) {
  const s = size
  if (type === 'streak') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 2 C6 6 4 9 6 12 C7 14 9 14 10 13 C9 11 10 9 12 8 C12 11 11 13 13 14 C15 13 16 11 15 8 C17 10 17 14 14 17 C12 19 8 19 6 17 C3 15 3 11 5 8 C7 5 9 3 10 2Z"
        fill="rgba(245,158,11,0.8)" stroke="rgba(245,158,11,0.4)" strokeWidth="0.5"/>
    </svg>
  )
  if (type === 'correct') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="rgba(16,185,129,0.6)" strokeWidth="1.5"/>
      <path d="M6 10 L9 13 L14 7" stroke="rgba(16,185,129,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'wins') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 2 L12.5 7.5 L18 8.2 L14 12 L15 18 L10 15.5 L5 18 L6 12 L2 8.2 L7.5 7.5Z"
        stroke="rgba(99,102,241,0.7)" strokeWidth="1.5" fill="rgba(99,102,241,0.1)" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'xp') return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <polygon points="10,2 13,8 19,8 14,12 16,18 10,14 4,18 6,12 1,8 7,8"
        stroke="rgba(34,211,238,0.7)" strokeWidth="1.2" fill="rgba(34,211,238,0.08)"
        strokeLinejoin="round"/>
    </svg>
  )
  return null
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding:40, maxWidth:600, margin:'80px auto' }}>
        <div style={{ fontFamily:'JetBrains Mono', color:'var(--red)', fontSize:14, marginBottom:8 }}>
          Render error
        </div>
        <pre style={{ fontSize:12, color:'var(--text2)', whiteSpace:'pre-wrap', lineHeight:1.6 }}>
          {this.state.error.message}
        </pre>
      </div>
    )
    return this.props.children
  }
}

function Toast({ msg, type, onClear }) {
  useEffect(() => { if (!msg) return; const t = setTimeout(onClear, 4000); return () => clearTimeout(t) }, [msg])
  if (!msg) return null
  return <div className={`toast toast-${type}`}>{msg}</div>
}

function Header({ account, connected, player, view, setView, onConnect, onDisconnect }) {
  const level = player?.level || 1
  return (
    <header className="header">
      <div className="logo" onClick={() => setView('home')}>
        <div className="logo-mark">GH</div>
        <span className="logo-text">GenHunt</span>
      </div>

      <nav style={{ display:'flex', gap:4 }}>
        {[['solo','Train'],['leaderboard','Board']].map(([v,label]) => (
          <button key={v} className={`nav-btn${view===v?' active':''}`} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </nav>

      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {connected && player?.username && (
          <button className="btn btn-ghost" style={{ gap:8, padding:'6px 12px' }}
                  onClick={() => setView('profile')}>
            <LevelIcon level={level} size={22} active/>
            <span style={{ fontSize:13, fontFamily:'JetBrains Mono', color:'#A5B4FC' }}>
              {(player.xp||0).toLocaleString()} XP
            </span>
          </button>
        )}
        {connected ? (
          <button className="btn btn-outline" style={{ fontSize:13, padding:'7px 14px' }} onClick={onDisconnect}>
            <span style={{ width:7,height:7,borderRadius:'50%',background:'var(--green)',
              display:'inline-block',flexShrink:0 }}/>
            {sh(account)}
          </button>
        ) : (
          <button className="btn btn-primary" style={{ padding:'8px 20px' }} onClick={onConnect}>
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  )
}

function Home({ account, connected, player, setView, onConnect }) {
  const level  = player?.level || 1
  const xp     = player?.xp || 0
  const nextXP = LEVEL_XP_THRESHOLD[String(level + 1)]
  const curXP  = LEVEL_XP_THRESHOLD[String(level)] || 0
  const prog   = nextXP ? Math.min(100, ((xp - curXP) / (nextXP - curXP)) * 100) : 100

  return (
    <div style={{ maxWidth:960, margin:'0 auto' }}>

      {/* Hero */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:40,
        alignItems:'center', padding:'72px 0 56px' }}>
        <div>
          <div className="pill fade-up" style={{ marginBottom:20, display:'inline-flex',
            background:'rgba(99,102,241,0.06)', borderColor:'rgba(99,102,241,0.18)',
            color:'#A5B4FC', animationDelay:'.05s' }}>
            Powered by GenLayer AI · Bradbury Testnet
          </div>
          <h1 className="fade-up" style={{ fontSize:'clamp(2.4rem,6vw,4.2rem)',
            fontWeight:800, lineHeight:1.1, marginBottom:20,
            letterSpacing:'-1.5px', animationDelay:'.1s' }}>
            Master Web3<br/>
            <span className="grad-text">Security.</span>
          </h1>
          <p className="fade-up" style={{ fontSize:17, color:'var(--text2)', maxWidth:460,
            marginBottom:36, lineHeight:1.75, animationDelay:'.15s' }}>
            8 levels of AI-generated cybersecurity questions.
            From basic phishing to nation-state attacks — earn XP on-chain.
          </p>
          <div className="fade-up" style={{ display:'flex', gap:12, flexWrap:'wrap', animationDelay:'.2s' }}>
            {connected ? (
              <button className="btn btn-primary" style={{ fontSize:15, padding:'12px 32px' }}
                      onClick={() => setView('solo')}>Start Training</button>
            ) : (
              <button className="btn btn-primary" style={{ fontSize:16, padding:'13px 36px' }}
                      onClick={onConnect}>Connect Wallet</button>
            )}
          </div>
        </div>
        <div className="fade-up" style={{ animationDelay:'.25s' }}>
          <Mascot size={160} style={{ filter:'drop-shadow(0 0 40px rgba(99,102,241,0.2))' }}/>
        </div>
      </div>

      {/* Player progress */}
      {connected && player && (
        <div className="card card-indigo fade-up" style={{ maxWidth:580, marginBottom:56, animationDelay:'.3s' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:6 }}>
                Welcome back, <strong style={{ color:'var(--text)' }}>{player.username || sh(account)}</strong>
              </div>
              <span className={`pill level-${Math.min(level,5)}`}>
                Level {level} — {LEVELS[String(level)]?.name}
              </span>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:26, fontWeight:800, fontFamily:'JetBrains Mono', color:'#A5B4FC' }}>
                {xp.toLocaleString()}
              </div>
              <div style={{ fontSize:11, color:'var(--text2)' }}>XP</div>
            </div>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width:`${prog}%` }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6,
            fontSize:11, color:'var(--text2)', fontFamily:'JetBrains Mono' }}>
            <span>{xp.toLocaleString()}</span>
            <span>{level < 8 ? `${nextXP?.toLocaleString()} to Level ${level+1}` : 'Max Level — Shadow'}</span>
          </div>
          <div style={{ display:'flex', gap:20, marginTop:16, paddingTop:16,
            borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            {[
              ['streak','streak', player.streak||0],
              ['correct','correct', player.total_correct||0],
              ['wins','xp', (player.levels_completed||[]).length + ' / 8'],
            ].map(([key, icon, val]) => (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <StatIcon type={icon} size={18}/>
                <span style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:15 }}>{val}</span>
                <span style={{ fontSize:11, color:'var(--text2)' }}>
                  {key==='streak'?'Streak':key==='correct'?'Correct':'Levels'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Level path preview */}
      <div style={{ marginBottom:56 }}>
        <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'JetBrains Mono',
          letterSpacing:'0.5px', marginBottom:16 }}>PROGRESSION PATH</div>
        <div style={{ display:'flex', alignItems:'center', overflowX:'auto', paddingBottom:8, gap:0 }}>
          {Object.entries(LEVELS).map(([l, lvl], i) => {
            const done = (player?.levels_completed||[]).includes(l)
            const cur  = String(player?.level||1) === l && !done
            return (
              <React.Fragment key={l}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                  gap:6, minWidth:72, cursor: connected ? 'pointer' : 'default' }}
                  onClick={() => connected && setView('solo')}>
                  <LevelIcon level={parseInt(l)} size={40}
                    done={done} active={cur}
                    locked={!done && parseInt(l) > (player?.level||1)} />
                  <span style={{ fontSize:10, fontFamily:'JetBrains Mono', textAlign:'center',
                    color: done ? lvl.color : cur ? lvl.color : 'var(--text2)',
                    whiteSpace:'nowrap' }}>{lvl.name}</span>
                </div>
                {i < 7 && (
                  <div style={{ flex:1, height:1, minWidth:16, marginBottom:22,
                    background: done ? `linear-gradient(90deg,${lvl.color},${LEVELS[String(i+2)]?.color||lvl.color})`
                      : 'rgba(255,255,255,0.07)' }}/>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Bottom stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, maxWidth:640, margin:'0 auto' }}>
        {[
          ['8', 'Levels'],
          ['5', 'Questions / Level'],
          ['AI', 'Always Fresh'],
          ['On-chain', 'All Progress'],
        ].map(([v,l]) => (
          <div key={l} className="stat-chip">
            <div style={{ fontSize:20, fontWeight:800, fontFamily:'JetBrains Mono',
              background:'linear-gradient(135deg,#fff,var(--indigo))',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{v}</div>
            <div style={{ fontSize:11, color:'var(--text2)', textAlign:'center', lineHeight:1.4 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [account,   setAccount]   = useState('')
  const [connected, setConnected] = useState(false)
  const [player,    setPlayer]    = useState(null)
  const [view,      setView]      = useState('home')
  const [toast,     setToast]     = useState({ msg:'', type:'ok' })
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [txBusy,    setTxBusy]    = useState(false)

  const notify = (msg, type='ok') => setToast({ msg, type })

  const loadPlayer = useCallback(async (addr) => {
    if (!CONTRACT_ADDR || !addr) return
    try {
      const raw = await readContract(CONTRACT_ADDR, 'get_player', [addr])
      if (raw && raw !== 'NOT_FOUND') {
        const p = JSON.parse(raw)
        setPlayer(p)
        window._ghAccount = addr
        if (!p.username) setShowUsernameModal(true)
      }
    } catch(e) { console.error('loadPlayer:', e) }
  }, [])

  const connectWallet = async () => {
    if (!window.ethereum) { notify('Install MetaMask or Rabby', 'err'); return }
    try {
      const accs = await window.ethereum.request({ method:'eth_requestAccounts' })
      await switchToBradbury()
      setAccount(accs[0]); setConnected(true); window._ghAccount = accs[0]
      await loadPlayer(accs[0])
    } catch(e) { notify(e.message || 'Connection failed', 'err') }
  }

  const disconnect = () => {
    setAccount(''); setConnected(false); setPlayer(null); setView('home')
  }

  const saveUsername = async () => {
    if (!usernameInput.trim()) return
    setTxBusy(true)
    try {
      const hash = await writeContract(CONTRACT_ADDR, account, 'set_username', [usernameInput.trim()], 0n, true)
      notify('Saving callsign...', 'inf')
      await waitTx(hash, () => notify('Finalising...', 'inf'))
      notify('Callsign saved', 'ok')
      setShowUsernameModal(false)
      await loadPlayer(account)
    } catch(e) { notify(e.message, 'err') } finally { setTxBusy(false) }
  }

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method:'eth_accounts' }).then(accs => {
        if (accs?.[0]) { setAccount(accs[0]); setConnected(true); window._ghAccount = accs[0]; loadPlayer(accs[0]) }
      }).catch(()=>{})
      window.ethereum.on('accountsChanged', accs => {
        if (!accs.length) disconnect()
        else { setAccount(accs[0]); window._ghAccount = accs[0]; loadPlayer(accs[0]) }
      })
    }
  }, [])

  const sharedProps = { account, connected, player, notify, loadPlayer, txBusy, setTxBusy }

  return (
    <ErrorBoundary>
    <div className="app">
      <Header account={account} connected={connected} player={player}
              view={view} setView={setView} onConnect={connectWallet} onDisconnect={disconnect} />
      <main className="main">
        {view==='home'        && <Home {...sharedProps} setView={setView} onConnect={connectWallet} />}
        {view==='solo'        && <SoloMode {...sharedProps} setView={setView} />}
        {view==='profile'     && <Profile {...sharedProps} setView={setView} />}
        {view==='leaderboard' && <Leaderboard {...sharedProps} />}
      </main>

      {showUsernameModal && (
        <div style={{ position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.75)',
          backdropFilter:'blur(20px)', display:'flex',alignItems:'center',
          justifyContent:'center', padding:20 }}>
          <div className="card scale-in" style={{ maxWidth:380,width:'100%',
            border:'1px solid rgba(99,102,241,0.25)',
            boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
            <Mascot size={56} style={{ marginBottom:16 }}/>
            <div style={{ fontWeight:800, fontSize:20, marginBottom:6, letterSpacing:'-0.3px' }}>
              Choose your callsign
            </div>
            <div style={{ fontSize:14, color:'var(--text2)', marginBottom:20, lineHeight:1.6 }}>
              Stored on-chain. Appears on leaderboards.
            </div>
            <input className="input" placeholder="e.g. CryptoHunter" value={usernameInput}
                   onChange={e => setUsernameInput(e.target.value)}
                   onKeyDown={e => e.key==='Enter' && saveUsername()}
                   maxLength={32} style={{ marginBottom:12 }} autoFocus />
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}
                    disabled={txBusy || !usernameInput.trim()} onClick={saveUsername}>
              {txBusy ? <><span className="spin-el"/>Saving...</> : 'Set Callsign'}
            </button>
          </div>
        </div>
      )}

      <Toast msg={toast.msg} type={toast.type} onClear={() => setToast({msg:'',type:'ok'})} />
    </div>
    </ErrorBoundary>
  )
}
