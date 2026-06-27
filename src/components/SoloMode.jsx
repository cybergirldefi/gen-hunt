import { useState, useEffect, useRef } from 'react'
import { readContract, writeContract, waitTx } from '../lib/gl.js'
import { CONTRACT_ADDR, LEVELS, sh } from '../lib/config.js'

const LEVEL_TOPICS = {
  '1': 'Basic Web3 Safety',
  '2': 'Wallets & Keys',
  '3': 'DeFi & Rug Pulls',
  '4': 'Smart Contract Vulns',
  '5': 'Advanced Exploits',
}

export default function SoloMode({ account, connected, player, notify, loadPlayer, txBusy, setTxBusy }) {
  const [phase,       setPhase]       = useState('levels')    // levels | loading | question | result | complete
  const [activeLevel, setActiveLevel] = useState(null)
  const [question,    setQuestion]    = useState(null)
  const [qId,         setQId]         = useState(null)
  const [selected,    setSelected]    = useState(null)
  const [result,      setResult]      = useState(null)
  const [sessionStats,setSessionStats]= useState({ correct:0, answered:0, xpEarned:0 })
  const decryptRef = useRef(null)

  if (!connected) {
    return (
      <div style={{ textAlign:'center', padding:'80px 0' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <div style={{ fontSize:18, fontWeight:700, fontFamily:'JetBrains Mono' }}>Connect wallet to train</div>
      </div>
    )
  }

  const currentLevel = player?.level || 1
  const completed    = player?.levels_completed || []

  const requestQuestion = async (level) => {
    setPhase('loading')
    setActiveLevel(level)
    setSelected(null)
    setResult(null)
    setTxBusy(true)
    try {
      // Read q_count BEFORE tx — gives us the exact question ID
      const beforeQ = await readContract(CONTRACT_ADDR, 'get_total_players', [])
      const newQId  = `q${parseInt(beforeQ || '0')}`

      // Send transaction (no need to await status — we poll the question directly)
      await writeContract(CONTRACT_ADDR, account, 'request_question', [String(level)], 0n, true)
      notify('AI is generating your question...', 'inf')

      // Poll get_question until it exists — this IS the confirmation signal
      // The moment the tx is accepted the question appears in contract state
      let q = null
      const maxAttempts = 120  // 6 minutes max
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000))
        try {
          const raw = await readContract(CONTRACT_ADDR, 'get_question', [newQId])
          if (raw && raw !== 'NOT_FOUND') {
            q = JSON.parse(raw)
            break
          }
        } catch(e) { /* keep polling */ }
        if (i === 10) notify('Still thinking — AI is working on it...', 'inf')
        if (i === 20) notify('Almost there — nearly done...', 'inf')
      }

      if (!q) throw new Error('Timed out — check your wallet for tx status')
      setQuestion(q)
      setQId(newQId)
      setPhase('question')
    } catch(e) {
      notify(e.message || 'Failed to generate question', 'err')
      setPhase('levels')
    } finally {
      setTxBusy(false)
    }
  }

  const submitAnswer = async (answer) => {
    if (!qId || selected) return
    setSelected(answer)
    setTxBusy(true)
    try {
      const hash = await writeContract(CONTRACT_ADDR, account, 'submit_answer', [qId, answer])
      notify('Submitting answer...', 'inf')
      await waitTx(hash, () => notify('Finalising...', 'inf'))

      // Get result
      const raw = await readContract(CONTRACT_ADDR, 'get_answer_result', [qId, answer])
      if (raw && raw !== 'NOT_FOUND') {
        const r = JSON.parse(raw)
        setResult(r)
        setSessionStats(s => ({
          correct:  s.correct  + (r.is_correct ? 1 : 0),
          answered: s.answered + 1,
          xpEarned: s.xpEarned + (r.is_correct ? (LEVELS[String(activeLevel)]?.xpReward || 100) : 0),
        }))
        await loadPlayer(account)
        setPhase('result')
      }
    } catch(e) {
      notify(e.message || 'Failed to submit', 'err')
      setSelected(null)
    } finally {
      setTxBusy(false)
    }
  }

  // ── Level select ──────────────────────────────────────────────────────────
  if (phase === 'levels') {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:8 }}>SOLO TRAINING</div>
          <h2 style={{ fontSize:28, fontWeight:800, fontFamily:'JetBrains Mono' }}>Choose your level</h2>
          <p style={{ color:'var(--muted)', marginTop:8 }}>Complete each level to unlock the next. 10 questions per level.</p>
        </div>

        {/* Level map connector */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:32, overflowX:'auto', paddingBottom:8 }}>
          {['1','2','3','4','5'].map((l, i) => {
            const lvl     = LEVELS[l]
            const done    = completed.includes(l)
            const locked  = parseInt(l) > currentLevel && !done
            const active  = String(currentLevel) === l
            return (
              <div key={l} style={{ display:'contents' }}>
                <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6,minWidth:80 }}>
                  <div
                    style={{
                      width:52, height:52, borderRadius:'50%',
                      border:`2px solid ${done ? lvl.color : locked ? 'rgba(100,116,139,0.3)' : lvl.color}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'JetBrains Mono', fontWeight:700, fontSize:18,
                      color: done ? lvl.color : locked ? 'var(--muted)' : lvl.color,
                      background: done ? `${lvl.color}20` : active ? `${lvl.color}10` : 'transparent',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      transition: 'all .2s',
                      boxShadow: active ? `0 0 16px ${lvl.color}40` : 'none',
                    }}
                    onClick={() => !locked && requestQuestion(parseInt(l))}
                  >
                    {done ? '✓' : l}
                  </div>
                  <span style={{ fontSize:11, color: locked ? 'var(--muted)' : lvl.color,
                    fontFamily:'JetBrains Mono', textAlign:'center' }}>
                    {lvl.name}
                  </span>
                </div>
                {i < 4 && (
                  <div style={{ flex:1, height:2, minWidth:24,
                    background: completed.includes(String(i+1)) ? 'var(--indigo)' : 'rgba(255,255,255,0.08)',
                    marginBottom:28 }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Level cards */}
        <div style={{ display:'grid', gap:12 }}>
          {['1','2','3','4','5'].map(l => {
            const lvl    = LEVELS[l]
            const done   = completed.includes(l)
            const locked = parseInt(l) > currentLevel && !done
            return (
              <div key={l} className="card" style={{
                borderColor: locked ? 'rgba(100,116,139,0.15)' : `${lvl.color}30`,
                opacity: locked ? 0.5 : 1,
                cursor: locked ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', gap:16,
              }}
              onClick={() => !locked && requestQuestion(parseInt(l))}>
                <div style={{ width:40,height:40, borderRadius:10, background:`${lvl.color}15`,
                  border:`1px solid ${lvl.color}40`, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:20, flexShrink:0 }}>
                  {done ? '✅' : locked ? '🔒' : '⚡'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontFamily:'JetBrains Mono' }}>Level {l} — {lvl.name}</span>
                    {done && <span className="pill" style={{ background:`${lvl.color}15`, border:`1px solid ${lvl.color}30`, color:lvl.color, fontSize:10 }}>COMPLETE</span>}
                    {String(currentLevel) === l && !done && <span className="pill" style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', color:'#A5B4FC', fontSize:10 }}>CURRENT</span>}
                  </div>
                  <div style={{ fontSize:13, color:'var(--muted)' }}>{LEVEL_TOPICS[l]}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:13, color: lvl.color, fontFamily:'JetBrains Mono', fontWeight:700 }}>+{lvl.xpReward} XP</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>per correct</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Session stats */}
        {sessionStats.answered > 0 && (
          <div className="card" style={{ marginTop:24, borderColor:'rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:12 }}>SESSION STATS</div>
            <div style={{ display:'flex', gap:24 }}>
              <div>
                <div style={{ fontSize:24, fontWeight:800, fontFamily:'JetBrains Mono', color:'var(--green)' }}>
                  {sessionStats.correct}/{sessionStats.answered}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>Correct</div>
              </div>
              <div>
                <div style={{ fontSize:24, fontWeight:800, fontFamily:'JetBrains Mono', color:'#A5B4FC' }}>
                  +{sessionStats.xpEarned}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>XP Earned</div>
              </div>
              <div>
                <div style={{ fontSize:24, fontWeight:800, fontFamily:'JetBrains Mono', color:'var(--cyan)' }}>
                  {player?.streak || 0}🔥
                </div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>Streak</div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ textAlign:'center', padding:'80px 20px' }}>
        <div style={{ width:64, height:64, borderRadius:16,
          background:'rgba(99,102,241,0.08)',
          border:'2px solid var(--indigo)',
          display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto 24px', fontSize:28 }}>⚡</div>
        <div style={{ fontFamily:'JetBrains Mono', fontSize:18, fontWeight:700, marginBottom:12 }}>
          AI is generating your question...
        </div>
        <div style={{ color:'var(--muted)', fontSize:14, marginBottom:32 }}>
          Level {activeLevel} — {LEVEL_TOPICS[String(activeLevel)]}
        </div>
        <div style={{ display:'flex', justifyContent:'center' }}>
          <span className="spin-el" style={{ width:32, height:32, borderWidth:3, color:'#A5B4FC' }} />
        </div>
        <div style={{ marginTop:24, fontFamily:'JetBrains Mono', fontSize:12, color:'var(--muted)' }}>
          Waiting for GenLayer AI consensus...
        </div>
      </div>
    )
  }

  // ── Question ──────────────────────────────────────────────────────────────
  if (phase === 'question' && question) {
    const lvlColor = LEVELS[String(activeLevel)]?.color || 'var(--indigo)'
    return (
      <div style={{ maxWidth:680, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <button className="btn btn-outline" style={{ padding:'6px 12px' }}
                  onClick={() => { setPhase('levels'); setQuestion(null) }}>
            ← Back
          </button>
          <span className={`pill level-${activeLevel}`} style={{ border:'1px solid' }}>
            Level {activeLevel} — {LEVELS[String(activeLevel)]?.name}
          </span>
          <span style={{ fontSize:13, color:'var(--muted)', fontFamily:'JetBrains Mono' }}>
            +{LEVELS[String(activeLevel)]?.xpReward} XP
          </span>
        </div>

        {/* Question card */}
        <div className="card card card-indigo scale-in" style={{ marginBottom:20, borderColor:`${lvlColor}30` }}>
          <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:16 }}>
            ▸ QUESTION
          </div>
          <div style={{ fontSize:18, fontWeight:600, lineHeight:1.6 }}>
            {question.question}
          </div>
        </div>

        {/* Answer options */}
        <div className="answer-grid">
          {['A','B','C','D'].map(opt => {
            let cls = 'answer-btn'
            if (selected === opt) cls += ' selected'
            return (
              <button key={opt} className={cls}
                      disabled={!!selected || txBusy}
                      onClick={() => submitAnswer(opt)}>
                <span className="answer-key">{opt}</span>
                <span>{question.options?.[opt] || ''}</span>
              </button>
            )
          })}
        </div>

        {txBusy && selected && (
          <div style={{ textAlign:'center', marginTop:20, color:'var(--muted)', fontSize:13, fontFamily:'JetBrains Mono', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <span className="spin-el" style={{ color:'#A5B4FC' }} />
            Submitting to GenLayer...
          </div>
        )}
      </div>
    )
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const lvlColor = LEVELS[String(activeLevel)]?.color || 'var(--indigo)'
    const xpGained = result.is_correct ? (LEVELS[String(activeLevel)]?.xpReward || 100) : 0
    return (
      <div style={{ maxWidth:680, margin:'0 auto', textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>
          {result.is_correct ? '✅' : '❌'}
        </div>
        <div style={{ fontSize:28, fontWeight:800, fontFamily:'JetBrains Mono', marginBottom:8,
          color: result.is_correct ? 'var(--green)' : 'var(--red)' }}>
          {result.is_correct ? 'Correct!' : 'Wrong!'}
        </div>
        {result.is_correct && (
          <div style={{ fontSize:20, color:'#A5B4FC', fontFamily:'JetBrains Mono', marginBottom:16 }}>
            +{xpGained} XP {player?.streak > 1 ? `🔥 ${player.streak} streak` : ''}
          </div>
        )}

        {/* Answer options revealed */}
        <div className="answer-grid" style={{ marginBottom:24 }}>
          {['A','B','C','D'].map(opt => {
            const isCorrect  = opt === result.correct
            const isSelected = opt === selected
            let cls = 'answer-btn answered'
            if (isCorrect)  cls += ' correct'
            if (isSelected && !isCorrect) cls += ' wrong'
            return (
              <button key={opt} className={cls} disabled>
                <span className="answer-key" style={{ color: isCorrect ? 'var(--green)' : isSelected ? 'var(--red)' : undefined }}>
                  {opt}
                </span>
                <span>{question?.options?.[opt]}</span>
              </button>
            )
          })}
        </div>

        {/* Explanation */}
        <div className="card" style={{ textAlign:'left', marginBottom:24, borderColor:`${lvlColor}30` }}>
          <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:8 }}>
            ▸ EXPLANATION
          </div>
          <div style={{ fontSize:14, lineHeight:1.7, color:'var(--text)' }}>
            {result.explanation}
          </div>
        </div>

        <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
          <button className="btn btn-primary"
                  onClick={() => { setPhase('question'); requestQuestion(activeLevel) }}
                  disabled={txBusy}>
            Next Question →
          </button>
          <button className="btn btn-outline"
                  onClick={() => { setPhase('levels'); setQuestion(null); setResult(null) }}>
            Change Level
          </button>
        </div>
      </div>
    )
  }

  return null
}
