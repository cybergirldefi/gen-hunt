import React, { useState, useEffect, useCallback } from 'react'
import { readContract, writeContract, waitTx, switchToBradbury } from './lib/gl.js'
import { CONTRACT_ADDR, sh, LEVELS, LEVEL_XP_THRESHOLD } from './lib/config.js'
import SoloMode    from './components/SoloMode.jsx'
import HuntMode    from './components/HuntMode.jsx'
import Profile     from './components/Profile.jsx'
import Leaderboard from './components/Leaderboard.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding:40, color:'#EF4444', fontFamily:'monospace' }}>
        <h2>Render Error</h2>
        <pre style={{ marginTop:16, whiteSpace:'pre-wrap', fontSize:13, color:'#94A3B8' }}>
          {this.state.error.message}
          {this.state.error.stack}
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
        {[['solo','⚡ Solo'],['hunt','⚔ Hunt'],['leaderboard','🏆 Board']].map(([v,label]) => (
          <button key={v} className={`nav-btn${view===v?' active':''}`} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </nav>

      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {connected && player?.username && (
          <button className="btn btn-ghost" style={{ gap:8 }} onClick={() => setView('profile')}>
            <span className={`pill level-${level}`} style={{ fontSize:10 }}>Lv.{level}</span>
            <span style={{ fontSize:13, fontFamily:'JetBrains Mono', color:'#A5B4FC' }}>
              {(player.xp||0).toLocaleString()} XP
            </span>
          </button>
        )}
        {connected ? (
          <button className="btn btn-outline" style={{ fontSize:13, padding:'7px 14px' }} onClick={onDisconnect}>
            <span style={{ width:7,height:7,borderRadius:'50%',background:'var(--green)',display:'inline-block',flexShrink:0 }}/>
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
    <div style={{ maxWidth:1000, margin:'0 auto' }}>

      {/* Hero */}
      <div style={{ textAlign:'center', padding:'80px 0 72px', position:'relative' }}>
        {/* Floating decorations */}
        <span className="shield-float" style={{ top:0, right:'8%', animationDelay:'.5s' }}>🛡</span>
        <span className="shield-float" style={{ top:'20%', left:'5%', animationDelay:'1.2s', fontSize:80 }}>🔐</span>

        <div className="pill fade-up" style={{ marginBottom:24, display:'inline-flex',
          background:'rgba(99,102,241,0.08)', borderColor:'rgba(99,102,241,0.2)', color:'#A5B4FC',
          animationDelay:'.05s' }}>
          ● Powered by GenLayer AI · Bradbury Testnet
        </div>

        <h1 className="fade-up" style={{ fontSize:'clamp(2.8rem,7vw,5.5rem)', fontWeight:800,
          lineHeight:1.1, marginBottom:24, animationDelay:'.1s', letterSpacing:'-1.5px' }}>
          Hunt for<br/>
          <span className="grad-text">Web3 Security</span><br/>
          Knowledge.
        </h1>

        <p className="fade-up" style={{ fontSize:18, color:'var(--text2)', maxWidth:520,
          margin:'0 auto 44px', lineHeight:1.7, animationDelay:'.15s' }}>
          AI-generated cybersecurity questions that adapt to your level.
          Compete in real-time Hunt battles. Earn XP on-chain.
        </p>

        <div className="fade-up" style={{ display:'flex', gap:12, justifyContent:'center',
          flexWrap:'wrap', animationDelay:'.2s' }}>
          {connected ? (
            <>
              <button className="btn btn-primary" style={{ fontSize:15, padding:'13px 32px' }}
                      onClick={() => setView('solo')}>
                ⚡ Start Solo Training
              </button>
              <button className="btn btn-cyan" style={{ fontSize:15, padding:'13px 32px' }}
                      onClick={() => setView('hunt')}>
                ⚔ Join a Hunt
              </button>
            </>
          ) : (
            <button className="btn btn-primary" style={{ fontSize:16, padding:'14px 40px' }}
                    onClick={onConnect}>
              Connect Wallet to Play
            </button>
          )}
        </div>
      </div>

      {/* Player progress card */}
      {connected && player && (
        <div className="card card-indigo fade-up" style={{ maxWidth:640, margin:'0 auto 64px', animationDelay:'.25s' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:6 }}>
                Welcome back, <strong style={{ color:'var(--text)' }}>{player.username || sh(account)}</strong>
              </div>
              <span className={`pill level-${level}`}>
                Level {level} — {LEVELS[String(level)]?.name}
              </span>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:28, fontWeight:800, fontFamily:'JetBrains Mono', color:'#A5B4FC' }}>
                {xp.toLocaleString()}
              </div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>XP</div>
            </div>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width:`${prog}%` }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8,
            fontSize:11, color:'var(--text2)', fontFamily:'JetBrains Mono' }}>
            <span>{xp.toLocaleString()} XP</span>
            <span>{level < 5 ? `${nextXP?.toLocaleString()} to Level ${level+1}` : '🏆 MAX LEVEL'}</span>
          </div>
          <div style={{ display:'flex', gap:20, marginTop:20, paddingTop:20,
            borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            {[
              ['🔥', player.streak||0, 'Streak'],
              ['✅', player.total_correct||0, 'Correct'],
              ['⚔', player.hunt_wins||0, 'Hunt Wins'],
            ].map(([icon,val,label]) => (
              <div key={label}>
                <span style={{ fontSize:16 }}>{icon}</span>
                <span style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:16,
                  marginLeft:6, color:'var(--text)' }}>{val}</span>
                <span style={{ fontSize:12, color:'var(--text2)', marginLeft:4 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',
        gap:16, marginBottom:64 }}>
        <div className="card card-indigo" style={{ cursor:'pointer', transition:'transform .2s, box-shadow .2s' }}
             onClick={() => connected ? setView('solo') : onConnect()}
             onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 16px 40px rgba(99,102,241,0.15)'}}
             onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
          <div style={{ width:48,height:48,borderRadius:12,background:'rgba(99,102,241,0.12)',
            border:'1px solid rgba(99,102,241,0.2)', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:22, marginBottom:16 }}>⚡</div>
          <div style={{ fontSize:19, fontWeight:700, marginBottom:8 }}>Solo Training</div>
          <div style={{ fontSize:14, color:'var(--text2)', lineHeight:1.6, marginBottom:20 }}>
            5 levels of AI-generated questions. Earn XP, build streaks, unlock harder levels.
            Every question is unique — no memorization, real learning.
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {['1','2','3','4','5'].map(l => (
              <span key={l} className={`pill level-${l}`} style={{ fontSize:10 }}>
                {LEVELS[l].name}
              </span>
            ))}
          </div>
        </div>

        <div className="card card-cyan" style={{ cursor:'pointer', transition:'transform .2s, box-shadow .2s' }}
             onClick={() => connected ? setView('hunt') : onConnect()}
             onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 16px 40px rgba(34,211,238,0.1)'}}
             onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
          <div style={{ width:48,height:48,borderRadius:12,background:'rgba(34,211,238,0.08)',
            border:'1px solid rgba(34,211,238,0.2)', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:22, marginBottom:16 }}>⚔</div>
          <div style={{ fontSize:19, fontWeight:700, marginBottom:8 }}>Hunt Mode</div>
          <div style={{ fontSize:14, color:'var(--text2)', lineHeight:1.6, marginBottom:20 }}>
            Up to 10 players. Same AI-generated questions for everyone. Fastest + most correct wins.
            Winner's trophy is recorded on-chain forever.
          </div>
          <span className="pill" style={{ background:'rgba(34,211,238,0.08)',
            border:'1px solid rgba(34,211,238,0.2)', color:'var(--cyan)', fontSize:10 }}>
            Multiplayer · Real-time · On-chain
          </span>
        </div>
      </div>

      {/* Bottom stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',
        gap:12, maxWidth:760, margin:'0 auto' }}>
        {[
          ['5', 'Security Levels'],
          ['10', 'Questions/Level'],
          ['AI', 'Generated — always fresh'],
          ['On-chain', 'Scores & history'],
        ].map(([val, label]) => (
          <div key={label} className="stat-chip">
            <div style={{ fontSize:24, fontWeight:800, fontFamily:'JetBrains Mono',
              background:'linear-gradient(135deg,#fff,var(--indigo))',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{val}</div>
            <div style={{ fontSize:11, color:'var(--text2)', textAlign:'center' }}>{label}</div>
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
      setAccount(accs[0]); setConnected(true)
      window._ghAccount = accs[0]
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
      const hash = await writeContract(CONTRACT_ADDR, account, 'set_username', [usernameInput.trim()])
      notify('Setting callsign...', 'inf')
      await waitTx(hash, () => notify('Finalising...', 'inf'))
      notify('Callsign saved!', 'ok')
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
              view={view} setView={setView}
              onConnect={connectWallet} onDisconnect={disconnect} />

      <main className="main">
        {view==='home'        && <Home {...sharedProps} account={account} setView={setView} onConnect={connectWallet} />}
        {view==='solo'        && <SoloMode {...sharedProps} setView={setView} />}
        {view==='hunt'        && <HuntMode {...sharedProps} setView={setView} />}
        {view==='profile'     && <Profile {...sharedProps} setView={setView} />}
        {view==='leaderboard' && <Leaderboard {...sharedProps} />}
      </main>

      {/* Username modal */}
      {showUsernameModal && (
        <div style={{ position:'fixed',inset:0,zIndex:300,
          background:'rgba(0,0,0,0.7)',backdropFilter:'blur(16px)',
          display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
          <div className="card scale-in" style={{ maxWidth:400,width:'100%',
            border:'1px solid rgba(99,102,241,0.3)', boxShadow:'0 24px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:24, marginBottom:4 }}>👾</div>
            <div style={{ fontWeight:800, fontSize:20, marginBottom:6 }}>Choose your callsign</div>
            <div style={{ fontSize:14, color:'var(--text2)', marginBottom:24, lineHeight:1.6 }}>
              Your callsign is stored on-chain and appears on the leaderboard and in Hunt results.
            </div>
            <input className="input" placeholder="e.g. CryptoBandit" value={usernameInput}
                   onChange={e => setUsernameInput(e.target.value)}
                   onKeyDown={e => e.key==='Enter' && saveUsername()}
                   maxLength={32} style={{ marginBottom:12 }} />
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}
                    disabled={txBusy || !usernameInput.trim()} onClick={saveUsername}>
              {txBusy ? <><span className="spin-el"/>Saving...</> : 'Set Callsign →'}
            </button>
          </div>
        </div>
      )}

      <Toast msg={toast.msg} type={toast.type} onClear={() => setToast({msg:'',type:'ok'})} />
    </div>
    </ErrorBoundary>
  )
}
