import { useState, useEffect } from 'react'
import { readContract, writeContract } from '../lib/gl.js'
import { CONTRACT_ADDR, LEVELS } from '../lib/config.js'
import { LevelIcon, ScoreRing } from '../App.jsx'
import Mascot from './Mascot.jsx'

const LEVEL_TOPICS = {
  '1':'Basic Web3 Safety', '2':'Wallets & Keys', '3':'DeFi & Rug Pulls',
  '4':'Smart Contract Vulns', '5':'Advanced Exploits', '6':'Zero-day & Side-channels',
  '7':'Social Engineering & OSINT', '8':'Nation-state & APT Attacks',
}

async function pollUntil(fn, intervalMs=3000, maxMs=360000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const result = await fn()
    if (result) return result
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Timed out — check your wallet and try again')
}

export default function SoloMode({ account, connected, player, notify, loadPlayer, txBusy, setTxBusy }) {
  const [phase,       setPhase]       = useState('levels')
  const [activeLevel, setActiveLevel] = useState(null)
  const [questions,   setQuestions]   = useState([])
  const [qIds,        setQIds]        = useState([])
  const [answers,     setAnswers]     = useState({})
  const [currentQ,    setCurrentQ]    = useState(0)
  const [results,     setResults]     = useState(null)
  const [genMsg,      setGenMsg]      = useState('AI is writing your quiz...')

  if (!connected) return (
    <div style={{ textAlign:'center', padding:'80px 0' }}>
      <Mascot size={80} style={{ marginBottom:20, opacity:0.6 }}/>
      <div style={{ fontSize:18, fontWeight:700, fontFamily:'JetBrains Mono' }}>
        Connect wallet to train
      </div>
    </div>
  )

  const currentLevel = player?.level || 1
  const completed    = player?.levels_completed || []

  // Resume on refresh
  useEffect(() => {
    if (!connected || !account || !CONTRACT_ADDR) return
    const checkResume = async () => {
      for (const l of Object.keys(LEVELS)) {
        try {
          const raw = await readContract(CONTRACT_ADDR, 'get_quiz_status', [account, l])
          if (!raw || raw === 'NOT_FOUND') continue
          const status = JSON.parse(raw)
          if (status.status === 'IN_PROGRESS' && status.q_ids?.length > 0) {
            const qs = []
            for (const qid of status.q_ids) {
              const qraw = await readContract(CONTRACT_ADDR, 'get_question', [qid])
              if (qraw && qraw !== 'NOT_FOUND') qs.push(JSON.parse(qraw))
            }
            if (qs.length === status.q_ids.length) {
              const answeredCount = Object.keys(status.answers || {}).length
              setActiveLevel(parseInt(l))
              setQIds(status.q_ids)
              setQuestions(qs)
              setAnswers(status.answers || {})
              setCurrentQ(answeredCount < qs.length ? answeredCount : 0)
              setPhase('quiz')
              notify(`Resumed Level ${l} — Q${answeredCount + 1}/5`, 'inf')
              return
            }
          }
        } catch(e) {}
      }
    }
    checkResume()
  }, [connected, account])

  const generateQuiz = async (level) => {
    setPhase('generating')
    setActiveLevel(level)
    setAnswers({}); setCurrentQ(0); setResults(null)
    setGenMsg('AI is writing your quiz...')
    setTxBusy(true)
    try {
      const beforeQ  = await readContract(CONTRACT_ADDR, 'get_total_questions', [])
      const baseN    = parseInt(beforeQ || '0')
      const expected = Array.from({length:5}, (_,i) => `q${baseN+i}`)

      await writeContract(CONTRACT_ADDR, account, 'request_level_quiz', [String(level)], 0n, true)
      notify('Generating questions...', 'inf')

      let tick = 0
      const msgs = [
        'AI is writing your quiz...',
        'Crafting tricky questions...',
        'Picking the best traps...',
        'Almost there...',
      ]
      const msgInterval = setInterval(() => {
        tick = (tick + 1) % msgs.length
        setGenMsg(msgs[tick])
      }, 5000)

      const firstQ = await pollUntil(async () => {
        const raw = await readContract(CONTRACT_ADDR, 'get_question', [expected[0]])
        return (raw && raw !== 'NOT_FOUND') ? raw : null
      }, 3000, 360000)

      clearInterval(msgInterval)

      const qs = [JSON.parse(firstQ)]
      for (let i = 1; i < 5; i++) {
        const raw = await readContract(CONTRACT_ADDR, 'get_question', [expected[i]])
        if (raw && raw !== 'NOT_FOUND') qs.push(JSON.parse(raw))
      }

      if (qs.length !== 5) throw new Error('Could not fetch all questions — try again')
      setQIds(expected)
      setQuestions(qs)
      setPhase('quiz')
      notify('Questions ready', 'ok')
    } catch(e) {
      notify(e.message || 'Failed to generate quiz', 'err')
      setPhase('levels')
    } finally { setTxBusy(false) }
  }

  const selectAnswer = (answer) => {
    if (answers[currentQ] !== undefined) return
    const newAnswers = { ...answers, [currentQ]: answer }
    setAnswers(newAnswers)
    setTimeout(() => {
      if (currentQ < questions.length - 1) setCurrentQ(q => q + 1)
    }, 500)
  }

  const submitAnswers = async () => {
    if (Object.keys(answers).length < questions.length) {
      notify('Answer all questions first', 'err'); return
    }
    setPhase('submitting')
    setTxBusy(true)
    try {
      await writeContract(CONTRACT_ADDR, account, 'submit_quiz_answers',
        [String(activeLevel), JSON.stringify(answers)], 0n, true)
      notify('Scoring your answers...', 'inf')

      const statusRaw = await pollUntil(async () => {
        const raw = await readContract(CONTRACT_ADDR, 'get_quiz_status', [account, String(activeLevel)])
        if (!raw || raw === 'NOT_FOUND') return null
        const s = JSON.parse(raw)
        return s.status === 'COMPLETED' ? s : null
      }, 3000, 360000)

      setResults(statusRaw)
      await loadPlayer(account)
      setPhase('results')
    } catch(e) {
      notify(e.message || 'Submit failed', 'err')
      setPhase('quiz')
    } finally { setTxBusy(false) }
  }

  const retryQuiz = async () => {
    setTxBusy(true)
    try {
      await writeContract(CONTRACT_ADDR, account, 'retry_quiz', [String(activeLevel)], 0n, true)
      notify('Resetting quiz...', 'inf')
      await new Promise(r => setTimeout(r, 4000))
      await loadPlayer(account)
      setPhase('levels'); setQuestions([]); setAnswers({}); setResults(null)
    } catch(e) { notify(e.message, 'err') } finally { setTxBusy(false) }
  }

  // ── Level select ──────────────────────────────────────────────────────────
  if (phase === 'levels') return (
    <div style={{ maxWidth:720, margin:'0 auto' }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'JetBrains Mono',
          marginBottom:8, letterSpacing:'0.5px' }}>SOLO TRAINING</div>
        <h2 style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px' }}>Choose your level</h2>
        <p style={{ color:'var(--text2)', marginTop:8, fontSize:14 }}>
          5 AI-generated questions per level. 4/5 correct to advance.
        </p>
      </div>

      <div style={{ display:'grid', gap:10 }}>
        {Object.entries(LEVELS).map(([l, lvl]) => {
          const done   = completed.includes(l)
          const locked = parseInt(l) > currentLevel && !done
          const isCurr = String(currentLevel) === l && !done
          return (
            <div key={l} className="card" style={{
              borderColor: locked ? 'rgba(255,255,255,0.04)' : `${lvl.color}20`,
              opacity: locked ? 0.35 : 1,
              cursor: locked ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', gap:14,
              padding:'16px 20px', transition:'all .2s',
            }}
            onClick={() => !locked && !txBusy && generateQuiz(parseInt(l))}
            onMouseEnter={e => { if(!locked) e.currentTarget.style.transform='translateX(4px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='' }}>
              <LevelIcon level={parseInt(l)} size={40}
                done={done} active={isCurr} locked={locked}/>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span style={{ fontWeight:700, fontFamily:'JetBrains Mono', fontSize:14 }}>
                    Level {l} — {lvl.name}
                  </span>
                  {done   && <span className="pill level-1" style={{ fontSize:9, padding:'2px 8px' }}>DONE</span>}
                  {isCurr && <span className="pill" style={{ fontSize:9, padding:'2px 8px',
                    background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)',
                    color:'var(--indigo)' }}>CURRENT</span>}
                </div>
                <div style={{ fontSize:12, color:'var(--text2)' }}>{LEVEL_TOPICS[l]}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:13, fontFamily:'JetBrains Mono', fontWeight:700,
                  color: lvl.color }}>+{lvl.xpReward * 5}</div>
                <div style={{ fontSize:10, color:'var(--text2)' }}>XP max</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Generating ────────────────────────────────────────────────────────────
  if (phase === 'generating') {
    const lvl = LEVELS[String(activeLevel)]
    return (
      <div style={{ textAlign:'center', padding:'80px 20px', maxWidth:420, margin:'0 auto' }}>
        <Mascot size={100} style={{ marginBottom:24,
          filter:'drop-shadow(0 0 24px rgba(99,102,241,0.3))',
          animation:'float 2s ease-in-out infinite' }}/>
        <div style={{ fontFamily:'JetBrains Mono', fontSize:18, fontWeight:700,
          marginBottom:8, color: lvl?.color }}>{genMsg}</div>
        <div style={{ color:'var(--text2)', fontSize:13, marginBottom:24 }}>
          Level {activeLevel} — {LEVEL_TOPICS[String(activeLevel)]}
        </div>
        <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:16 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ width:8, height:8, borderRadius:'50%',
              background: lvl?.color || 'var(--indigo)', opacity:0.3,
              animation:`pulse ${0.8 + i*0.15}s ease-in-out infinite alternate` }}/>
          ))}
        </div>
        <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)', fontFamily:'JetBrains Mono' }}>
          Keep this tab open
        </div>
      </div>
    )
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  if (phase === 'quiz' && questions.length > 0) {
    const q          = questions[currentQ]
    const answered   = answers[currentQ]
    const allAnswered= Object.keys(answers).length === questions.length
    const lvlColor   = LEVELS[String(activeLevel)]?.color || 'var(--indigo)'

    return (
      <div style={{ maxWidth:640, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <button className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:13 }}
                  onClick={() => { setPhase('levels'); setQuestions([]); setAnswers({}) }}>
            Back
          </button>
          <span className={`pill level-${Math.min(activeLevel,5)}`}>
            Level {activeLevel} — {LEVELS[String(activeLevel)]?.name}
          </span>
          <span style={{ fontSize:12, color:'var(--text2)', fontFamily:'JetBrains Mono' }}>
            {Object.keys(answers).length}/5
          </span>
        </div>

        {/* Question number dots */}
        <div style={{ display:'flex', gap:6, marginBottom:24, justifyContent:'center' }}>
          {questions.map((_,i) => (
            <div key={i} onClick={() => setCurrentQ(i)} style={{
              width:34, height:34, borderRadius:8, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontFamily:'JetBrains Mono', fontWeight:700,
              background: i===currentQ ? 'rgba(99,102,241,0.12)'
                : answers[i] !== undefined ? `${LEVELS[String(activeLevel)]?.color}12` : 'rgba(255,255,255,0.03)',
              border: i===currentQ ? '1px solid rgba(99,102,241,0.35)'
                : answers[i] !== undefined ? `1px solid ${LEVELS[String(activeLevel)]?.color}30` : '1px solid rgba(255,255,255,0.06)',
              color: i===currentQ ? 'var(--indigo)'
                : answers[i] !== undefined ? LEVELS[String(activeLevel)]?.color : 'var(--text2)',
              transition:'all .15s',
            }}>
              {answers[i] !== undefined ? answers[i] : i+1}
            </div>
          ))}
        </div>

        <div className="card scale-in" style={{ marginBottom:18,
          borderColor:`${LEVELS[String(activeLevel)]?.color}20`,
          borderLeft:`3px solid ${lvlColor}` }}>
          <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'JetBrains Mono',
            marginBottom:12, letterSpacing:'0.5px' }}>
            QUESTION {currentQ + 1} OF {questions.length}
          </div>
          <div style={{ fontSize:17, fontWeight:600, lineHeight:1.65 }}>{q?.question}</div>
        </div>

        <div className="answer-grid" style={{ marginBottom:20 }}>
          {['A','B','C','D'].map(opt => (
            <button key={opt}
              className={`answer-btn${answered===opt?' selected':''}`}
              disabled={answered !== undefined}
              onClick={() => selectAnswer(opt)}>
              <span className="answer-key">{opt}</span>
              <span style={{ fontSize:14, lineHeight:1.5 }}>{q?.options?.[opt]}</span>
            </button>
          ))}
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:8 }}>
            {currentQ > 0 && (
              <button className="btn btn-outline" style={{ fontSize:13 }}
                      onClick={() => setCurrentQ(q => q-1)}>Prev</button>
            )}
            {currentQ < questions.length-1 && answered !== undefined && (
              <button className="btn btn-outline" style={{ fontSize:13 }}
                      onClick={() => setCurrentQ(q => q+1)}>Next</button>
            )}
          </div>
          {allAnswered && (
            <button className="btn btn-primary" disabled={txBusy} onClick={submitAnswers}
                    style={{ padding:'10px 28px' }}>
              {txBusy ? <><span className="spin-el"/>Submitting...</> : 'Submit Answers'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Submitting ────────────────────────────────────────────────────────────
  if (phase === 'submitting') return (
    <div style={{ textAlign:'center', padding:'80px 20px' }}>
      <Mascot size={80} style={{ marginBottom:20, opacity:0.7,
        animation:'float 2s ease-in-out infinite' }}/>
      <div style={{ fontFamily:'JetBrains Mono', fontSize:18, fontWeight:700, marginBottom:8 }}>
        Scoring your answers...
      </div>
      <div style={{ color:'var(--text2)', fontSize:13 }}>Usually 15-30 seconds</div>
    </div>
  )

  // ── Results ────────────────────────────────────────────────────────────────
  if (phase === 'results' && results) {
    const score    = results.score || 0
    const total    = results.q_ids?.length || 5
    const passed   = results.passed
    const xpEarned = results.xp_earned || 0
    const lvl      = LEVELS[String(activeLevel)]

    return (
      <div style={{ maxWidth:640, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <ScoreRing score={score} total={total}
            color={passed ? 'var(--green)' : 'var(--amber)'}
            size={120}/>
          <div style={{ fontFamily:'JetBrains Mono', fontSize:22, fontWeight:800,
            marginTop:12, marginBottom:4,
            color: passed ? 'var(--green)' : 'var(--amber)' }}>
            {passed ? `Level ${activeLevel} cleared` : `Need ${lvl?.passScore || 4}/5 to pass`}
          </div>
          {xpEarned > 0 && (
            <div style={{ fontSize:17, color:'#A5B4FC', fontFamily:'JetBrains Mono',
              fontWeight:700 }}>+{xpEarned} XP</div>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
          {(results.results || []).map((r, i) => (
            <div key={i} className="card" style={{
              borderColor: r.is_correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)',
              borderLeft: `3px solid ${r.is_correct ? 'var(--green)' : 'var(--red)'}`,
              padding:'16px 20px',
            }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ width:20, height:20, borderRadius:5, flexShrink:0,
                  background: r.is_correct ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${r.is_correct ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, color: r.is_correct ? 'var(--green)' : 'var(--red)',
                  fontWeight:700 }}>
                  {r.is_correct ? '✓' : '✗'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:6, lineHeight:1.5 }}>
                    {r.question}
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--text2)' }}>
                    <span>Your answer:
                      <strong style={{ color: r.is_correct ? 'var(--green)' : 'var(--red)',
                        fontFamily:'JetBrains Mono', marginLeft:4 }}>{r.user_answer}</strong>
                    </span>
                    {!r.is_correct && (
                      <span>Correct:
                        <strong style={{ color:'var(--green)',
                          fontFamily:'JetBrains Mono', marginLeft:4 }}>{r.correct}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.65,
                background:'rgba(255,255,255,0.02)', borderRadius:8,
                padding:'10px 12px' }}>
                {r.explanation}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          {passed && parseInt(activeLevel) < 8 && (
            <button className="btn btn-primary"
                    onClick={() => { setPhase('levels'); setQuestions([]); setAnswers({}); setResults(null) }}>
              Next Level
            </button>
          )}
          <button className="btn btn-outline" disabled={txBusy} onClick={retryQuiz}>
            {txBusy ? <><span className="spin-el"/>...</> : 'Retry'}
          </button>
          <button className="btn btn-ghost"
                  onClick={() => { setPhase('levels'); setQuestions([]); setAnswers({}); setResults(null) }}>
            All Levels
          </button>
        </div>
      </div>
    )
  }

  return null
}
