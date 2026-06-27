import React, { useState, useEffect, useCallback } from 'react'
import { readContract, writeContract, waitTx, switchToBradbury } from './lib/gl.js'
import { CONTRACT_ADDR, sh, LEVELS, LEVEL_XP_THRESHOLD } from './lib/config.js'
import SoloMode    from './components/SoloMode.jsx'
import HuntMode    from './components/HuntMode.jsx'
import Profile     from './components/Profile.jsx'
import Leaderboard from './components/Leaderboard.jsx'
import Mascot      from './components/Mascot.jsx'

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
        {[['solo','Solo'],['hunt','Hunt'],['leaderboard','Board']].map(([v,label]) => (
          <button key={v} className={`nav-btn${view===v?' active':''}`} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </nav>

      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {connected && player?.username && (
          <button className="btn btn-ghost" style={{ gap:8, padding:'6px 12px' }}
                  onClick={() => setView('profile')}>
            <span className={`pill level-${level}`} style={{ fontSize:10 }}>Lv.{level}</span>
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
        alignItems:'center', padding:'80px 0 64px' }}>
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
            AI-generated cybersecurity questions that never repeat.
            5 levels of mastery. Battle others in real-time Hunt mode.
          </p>
          <div className="fade-up" style={{ display:'flex', gap:12, flexWrap:'wrap', animationDelay:'.2s' }}>
            {connected ? (
              <>
                <button className="btn btn-primary" style={{ fontSize:15, padding:'12px 28px' }}
                        onClick={() => setView('solo')}>Start Training</button>
                <button className="btn btn-cyan"    style={{ fontSize:15, padding:'12px 28px' }}
                        onClick={() => setView('hunt')}>Join a Hunt</button>
              </>
            ) : (
              <button className="btn btn-primary" style={{ fontSize:16, padding:'13px 36px' }}
                      onClick={onConnect}>Connect Wallet</button>
            )}
          </div>
        </div>

        {/* Mascot */}
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
                Welcome back,{' '}
                <strong style={{ color:'var(--text)' }}>{player.username || sh(account)}</strong>
              </div>
              <span className={`pill level-${level}`}>Level {level} — {LEVELS[String(level)]?.name}</span>
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
            <span>{level < 5 ? `${nextXP?.toLocaleString()} to Level ${level+1}` : 'Max Level'}</span>
          </div>
          <div style={{ display:'flex', gap:24, marginTop:16, paddingTop:16,
            borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            {[
              ['Streak',       player.streak||0],
              ['Correct',      player.total_correct||0],
              ['Hunt Wins',    player.hunt_wins||0],
            ].map(([label,val]) => (
              <div key={label}>
                <span style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:16 }}>{val}</span>
                <span style={{ fontSize:12, color:'var(--text2)', marginLeft:6 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',
        gap:14, marginBottom:56 }}>
        {[
          {
            key: 'solo', label:'Solo Training', sub:'btn-primary-outline',
            desc:'5 levels of AI-generated cybersecurity questions. Earn XP, build streaks, unlock harder levels. Every question is unique.',
            action: () => connected ? setView('solo') : onConnect(),
            cta:'Start Training',
            border:'rgba(99,102,241,0.2)', shadow:'rgba(99,102,241,0.08)',
            badges: ['1','2','3','4','5'].map(l => ({ label: LEVELS[l].name, cls:`level-${l}` })),
          },
          {
            key: 'hunt', label:'Hunt Mode', sub:'',
            desc:'Same questions for every player. Fastest and most correct wins. Results recorded on-chain permanently.',
            action: () => connected ? setView('hunt') : onConnect(),
            cta:'Join a Hunt',
            border:'rgba(34,211,238,0.18)', shadow:'rgba(34,211,238,0.06)',
            badges: [{ label:'Multiplayer', cls:'level-2' }, { label:'On-chain', cls:'level-4' }],
          },
        ].map(m => (
          <div key={m.key} className="card" style={{
            borderColor: m.border, cursor:'pointer',
            transition:'transform .2s, box-shadow .2s',
            boxShadow: `0 0 30px ${m.shadow}`,
          }}
          onClick={m.action}
          onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 12px 40px ${m.shadow}` }}
          onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 0 30px ${m.shadow}` }}>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:10, letterSpacing:'-0.3px' }}>
              {m.label}
            </div>
            <div style={{ fontSize:14, color:'var(--text2)', lineHeight:1.7, marginBottom:20, minHeight:72 }}>
              {m.desc}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
              {m.badges.map(b => (
                <span key={b.label} className={`pill ${b.cls}`} style={{ fontSize:10 }}>{b.label}</span>
              ))}
            </div>
            <button className={`btn ${m.key==='solo'?'btn-primary':'btn-cyan'}`}
                    style={{ fontSize:13, padding:'8px 20px' }}>
              {m.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, maxWidth:640, margin:'0 auto' }}>
        {[['5','Levels'],['5','Questions / Level'],['AI','Always Fresh'],['On-chain','All Progress']].map(([v,l]) => (
          <div key={l} className="stat-chip">
            <div style={{ fontSize:22, fontWeight:800, fontFamily:'JetBrains Mono',
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
        {view==='hunt'        && <HuntMode {...sharedProps} setView={setView} />}
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
              Stored on-chain. Appears on leaderboards and Hunt results.
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
