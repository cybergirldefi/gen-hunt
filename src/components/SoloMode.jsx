import { useState, useEffect, useCallback } from 'react'
import { readContract, writeContract, waitTx } from '../lib/gl.js'
import { CONTRACT_ADDR, LEVELS } from '../lib/config.js'

const LEVEL_TOPICS = {
 '1': 'Basic Web3 Safety',
 '2': 'Wallets & Keys',
 '3': 'DeFi & Rug Pulls',
 '4': 'Smart Contract Vulns',
 '5': 'Advanced Exploits',
}

// Poll until condition is true or timeout
async function pollUntil(fn, intervalMs=3000, maxMs=300000) {
 const start = Date.now()
 while (Date.now() - start < maxMs) {
 const result = await fn()
 if (result) return result
 await new Promise(r => setTimeout(r, intervalMs))
 }
 throw new Error('Timed out waiting for data')
}

export default function SoloMode({ account, connected, player, notify, loadPlayer, txBusy, setTxBusy }) {
 const [phase, setPhase] = useState('levels') // levels | generating | quiz | submitting | results
 const [activeLevel,setActiveLevel]= useState(null)
 const [questions, setQuestions] = useState([]) // array of 5 question objects
 const [qIds, setQIds] = useState([])
 const [answers, setAnswers] = useState({}) // {0:'A', 1:'C', ...}
 const [currentQ, setCurrentQ] = useState(0)
 const [results, setResults] = useState(null)

 if (!connected) return (
 <div style={{ textAlign:'center', padding:'80px 0' }}>
 <div style={{ fontSize:48, marginBottom:16 }}></div>
 <div style={{ fontSize:18, fontWeight:700, fontFamily:'JetBrains Mono' }}>Connect wallet to train</div>
 </div>
 )

 const currentLevel = player?.level || 1
 const completed = player?.levels_completed || []

 // ── On mount: check for in-progress quiz ────────────────────────────────
 useEffect(() => {
 if (!connected || !account || !CONTRACT_ADDR) return
 // Check if there's an active quiz in contract state
 const checkResume = async () => {
 for (const l of ['1','2','3','4','5']) {
 try {
 const raw = await readContract(CONTRACT_ADDR, 'get_quiz_status', [account, l])
 if (!raw || raw === 'NOT_FOUND') continue
 const status = JSON.parse(raw)
 if (status.status === 'IN_PROGRESS' && status.q_ids?.length > 0) {
 // Fetch all questions
 const qs = []
 for (const qid of status.q_ids) {
 const qraw = await readContract(CONTRACT_ADDR, 'get_question', [qid])
 if (qraw && qraw !== 'NOT_FOUND') qs.push(JSON.parse(qraw))
 }
 if (qs.length === status.q_ids.length) {
 // Resume from where they left off
 const answeredCount = Object.keys(status.answers || {}).length
 setActiveLevel(parseInt(l))
 setQIds(status.q_ids)
 setQuestions(qs)
 setAnswers(status.answers || {})
 setCurrentQ(answeredCount < qs.length ? answeredCount : 0)
 setPhase('quiz')
 notify(`Resumed Level ${l} quiz — question ${answeredCount + 1}/5`, 'inf')
 return
 }
 }
 } catch(e) {}
 }
 }
 checkResume()
 }, [connected, account])

 // ── Generate quiz (1 tx for all 5 questions) ────────────────────────────
 const generateQuiz = async (level) => {
 setPhase('generating')
 setActiveLevel(level)
 setAnswers({})
 setCurrentQ(0)
 setResults(null)
 setTxBusy(true)
 try {
 // Read current q_count BEFORE tx → we know exactly which 5 IDs will be created
 const beforeQ = await readContract(CONTRACT_ADDR, 'get_total_questions', [])
 const baseN = parseInt(beforeQ || '0')
 const expected = Array.from({length:5}, (_,i) => `q${baseN + i}`)

 await writeContract(CONTRACT_ADDR, account, 'request_level_quiz', [String(level)], 0n, true)
 notify('AI generating 5 questions...', 'inf')

 // Poll first question — when q{baseN} exists, all 5 are done (written atomically)
 const firstQ = await pollUntil(async () => {
 const raw = await readContract(CONTRACT_ADDR, 'get_question', [expected[0]])
 return (raw && raw !== 'NOT_FOUND') ? raw : null
 }, 3000, 300000)

 // Fetch all 5
 const qs = [JSON.parse(firstQ)]
 for (let i = 1; i < 5; i++) {
 const raw = await readContract(CONTRACT_ADDR, 'get_question', [expected[i]])
 if (raw && raw !== 'NOT_FOUND') qs.push(JSON.parse(raw))
 }

 if (qs.length !== 5) throw new Error('Could not fetch all questions — try again')

 setQIds(expected)
 setQuestions(qs)
 setPhase('quiz')
 notify('Questions ready!', 'ok')
 } catch(e) {
 notify(e.message || 'Failed to generate quiz', 'err')
 setPhase('levels')
 } finally {
 setTxBusy(false)
 }
 }

 // ── Answer a question (local — no chain call) ────────────────────────────
 const selectAnswer = (answer) => {
 if (answers[currentQ] !== undefined) return // already answered
 const newAnswers = { ...answers, [currentQ]: answer }
 setAnswers(newAnswers)
 // Auto-advance after short delay
 setTimeout(() => {
 if (currentQ < questions.length - 1) {
 setCurrentQ(q => q + 1)
 }
 }, 600)
 }

 // ── Submit all answers (1 tx) ────────────────────────────────────────────
 const submitAnswers = async () => {
 if (Object.keys(answers).length < questions.length) {
 notify('Answer all questions first', 'err'); return
 }
 setPhase('submitting')
 setTxBusy(true)
 try {
 await writeContract(CONTRACT_ADDR, account, 'submit_quiz_answers',
 [String(activeLevel), JSON.stringify(answers)], 0n, true)
 notify('Submitting answers...', 'inf')

 // Poll until quiz status shows COMPLETED
 const statusRaw = await pollUntil(async () => {
 const raw = await readContract(CONTRACT_ADDR, 'get_quiz_status', [account, String(activeLevel)])
 if (!raw || raw === 'NOT_FOUND') return null
 const s = JSON.parse(raw)
 return s.status === 'COMPLETED' ? s : null
 }, 3000, 300000)

 setResults(statusRaw)
 await loadPlayer(account)
 setPhase('results')
 notify('Quiz complete!', 'ok')
 } catch(e) {
 notify(e.message || 'Submit failed', 'err')
 setPhase('quiz')
 } finally {
 setTxBusy(false)
 }
 }

 // ── Retry quiz ────────────────────────────────────────────────────────────
 const retryQuiz = async () => {
 setTxBusy(true)
 try {
 await writeContract(CONTRACT_ADDR, account, 'retry_quiz', [String(activeLevel)], 0n, true)
 notify('Resetting quiz...', 'inf')
 await new Promise(r => setTimeout(r, 4000))
 await loadPlayer(account)
 setPhase('levels')
 setQuestions([]); setAnswers({}); setResults(null)
 } catch(e) {
 notify(e.message, 'err')
 } finally {
 setTxBusy(false)
 }
 }

 // ── Level select ──────────────────────────────────────────────────────────
 if (phase === 'levels') return (
 <div style={{ maxWidth:720, margin:'0 auto' }}>
 <div style={{ marginBottom:32 }}>
 <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'JetBrains Mono', marginBottom:8 }}>SOLO TRAINING</div>
 <h2 style={{ fontSize:28, fontWeight:800, fontFamily:'JetBrains Mono', letterSpacing:'-0.5px' }}>
 Choose your level
 </h2>
 <p style={{ color:'var(--text2)', marginTop:8 }}>5 AI-generated questions per level. Answer all 5 then submit.</p>
 </div>

 <div style={{ display:'grid', gap:12 }}>
 {['1','2','3','4','5'].map(l => {
 const lvl = LEVELS[l]
 const done = completed.includes(l)
 const locked = parseInt(l) > currentLevel && !done
 const isCurr = String(currentLevel) === l && !done
 return (
 <div key={l} className="card" style={{
 borderColor: locked ? 'rgba(255,255,255,0.05)' : `${lvl.color}25`,
 opacity: locked ? 0.4 : 1,
 cursor: locked ? 'not-allowed' : 'pointer',
 display:'flex', alignItems:'center', gap:16,
 transition:'all .2s',
 }}
 onClick={() => !locked && !txBusy && generateQuiz(parseInt(l))}
 onMouseEnter={e => { if(!locked) e.currentTarget.style.transform='translateY(-2px)' }}
 onMouseLeave={e => { e.currentTarget.style.transform='' }}>
 <div style={{ width:48,height:48, borderRadius:12, flexShrink:0,
 background:`${lvl.color}12`, border:`1px solid ${lvl.color}30`,
 display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
 {done ? '' : locked ? '' : isCurr ? '' : '○'}
 </div>
 <div style={{ flex:1 }}>
 <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
 <span style={{ fontWeight:700, fontFamily:'JetBrains Mono' }}>
 Level {l} — {lvl.name}
 </span>
 {done && <span className="pill level-1" style={{ fontSize:10 }}>COMPLETE</span>}
 {isCurr && <span className="pill" style={{ background:'rgba(99,102,241,0.1)',
 border:'1px solid rgba(99,102,241,0.2)', color:'var(--indigo)', fontSize:10 }}>CURRENT</span>}
 </div>
 <div style={{ fontSize:13, color:'var(--text2)' }}>{LEVEL_TOPICS[l]}</div>
 </div>
 <div style={{ textAlign:'right', flexShrink:0 }}>
 <div style={{ fontSize:14, fontFamily:'JetBrains Mono', fontWeight:700, color:lvl.color }}>
 +{lvl.xpReward * 5} XP
 </div>
 <div style={{ fontSize:11, color:'var(--text2)' }}>max per level</div>
 </div>
 </div>
 )
 })}
 </div>
 </div>
 )

 // ── Generating ────────────────────────────────────────────────────────────
 if (phase === 'generating') return (
 <div style={{ textAlign:'center', padding:'80px 20px', maxWidth:480, margin:'0 auto' }}>
 <div style={{ width:64,height:64, borderRadius:16, background:'rgba(99,102,241,0.08)',
 border:'1px solid rgba(99,102,241,0.2)', display:'flex', alignItems:'center',
 justifyContent:'center', margin:'0 auto 24px', fontSize:28 }}></div>
 <div style={{ fontFamily:'JetBrains Mono', fontSize:20, fontWeight:700, marginBottom:8 }}>
 Generating 5 questions...
 </div>
 <div style={{ color:'var(--text2)', fontSize:14, marginBottom:32 }}>
 Level {activeLevel} — {LEVEL_TOPICS[String(activeLevel)]}
 </div>
 <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
 <span className="spin-el" style={{ width:32,height:32,borderWidth:3,color:'var(--indigo)' }} />
 </div>
 <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'JetBrains Mono' }}>
 AI is writing your quiz — usually 15-30 seconds
 </div>
 <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)', marginTop:6 }}>Keep this tab open</div>
 </div>
 )

 // ── Quiz ──────────────────────────────────────────────────────────────────
 if (phase === 'quiz' && questions.length > 0) {
 const q = questions[currentQ]
 const answered = answers[currentQ]
 const allAnswered= Object.keys(answers).length === questions.length
 const lvlColor = LEVELS[String(activeLevel)]?.color || 'var(--indigo)'

 return (
 <div style={{ maxWidth:680, margin:'0 auto' }}>
 {/* Header */}
 <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
 <button className="btn btn-ghost" style={{ padding:'6px 12px' }}
 onClick={() => { setPhase('levels'); setQuestions([]); setAnswers({}) }}>
 ← Back
 </button>
 <span className={`pill level-${activeLevel}`}>
 Level {activeLevel} — {LEVELS[String(activeLevel)]?.name}
 </span>
 <span style={{ fontSize:13, color:'var(--text2)', fontFamily:'JetBrains Mono' }}>
 {Object.keys(answers).length}/5 answered
 </span>
 </div>

 {/* Progress dots */}
 <div style={{ display:'flex', gap:8, marginBottom:24, justifyContent:'center' }}>
 {questions.map((_,i) => (
 <div key={i} onClick={() => setCurrentQ(i)}
 style={{ width:32,height:32, borderRadius:8, cursor:'pointer',
 display:'flex', alignItems:'center', justifyContent:'center',
 fontSize:13, fontFamily:'JetBrains Mono', fontWeight:700,
 background: i===currentQ ? 'rgba(99,102,241,0.15)' : answers[i] ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
 border: i===currentQ ? '1px solid rgba(99,102,241,0.4)' : answers[i] ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.07)',
 color: i===currentQ ? 'var(--indigo)' : answers[i] ? 'var(--green)' : 'var(--text2)',
 transition:'all .15s'
 }}>
 {answers[i] ? answers[i] : i+1}
 </div>
 ))}
 </div>

 {/* Question */}
 <div className="card scale-in" style={{ marginBottom:20, borderColor:`${lvlColor}25` }}>
 <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'JetBrains Mono', marginBottom:12 }}>
 ▸ QUESTION {currentQ + 1} OF {questions.length}
 </div>
 <div style={{ fontSize:18, fontWeight:600, lineHeight:1.6 }}>{q?.question}</div>
 </div>

 {/* Options */}
 <div className="answer-grid" style={{ marginBottom:24 }}>
 {['A','B','C','D'].map(opt => (
 <button key={opt}
 className={`answer-btn${answered===opt?' selected':''}`}
 disabled={answered !== undefined}
 onClick={() => selectAnswer(opt)}>
 <span className="answer-key">{opt}</span>
 <span>{q?.options?.[opt]}</span>
 </button>
 ))}
 </div>

 {/* Navigation */}
 <div style={{ display:'flex', gap:10, justifyContent:'space-between', alignItems:'center' }}>
 <div style={{ display:'flex', gap:8 }}>
 {currentQ > 0 && (
 <button className="btn btn-outline" onClick={() => setCurrentQ(q => q-1)}>← Prev</button>
 )}
 {currentQ < questions.length-1 && answered !== undefined && (
 <button className="btn btn-outline" onClick={() => setCurrentQ(q => q+1)}>Next →</button>
 )}
 </div>
 {allAnswered && (
 <button className="btn btn-primary" disabled={txBusy} onClick={submitAnswers}>
 {txBusy ? <><span className="spin-el"/>Submitting...</> : ' Submit Answers'}
 </button>
 )}
 </div>
 </div>
 )
 }

 // ── Submitting ────────────────────────────────────────────────────────────
 if (phase === 'submitting') return (
 <div style={{ textAlign:'center', padding:'80px 20px' }}>
 <div style={{ fontSize:14, fontFamily:'JetBrains Mono', color:'var(--indigo)', marginBottom:16 }}>Processing</div>
 <div style={{ fontFamily:'JetBrains Mono', fontSize:20, fontWeight:700, marginBottom:8 }}>
 AI is scoring your answers...
 </div>
 <div style={{ color:'var(--text2)', marginBottom:32 }}>Usually 15-30 seconds</div>
 <span className="spin-el" style={{ width:32,height:32,borderWidth:3,color:'var(--indigo)' }} />
 </div>
 )

 // ── Results ───────────────────────────────────────────────────────────────
 if (phase === 'results' && results) {
 const score = results.score || 0
 const total = results.q_ids?.length || 5
 const passed = results.passed
 const xpEarned = results.xp_earned || 0
 const lvl = LEVELS[String(activeLevel)]

 return (
 <div style={{ maxWidth:680, margin:'0 auto' }}>
 {/* Score header */}
 <div style={{ textAlign:'center', marginBottom:32 }}>
 <div style={{ fontSize:64, marginBottom:8 }}>{passed ? '' : ''}</div>
 <div style={{ fontFamily:'JetBrains Mono', fontSize:32, fontWeight:800,
 color: passed ? 'var(--green)' : 'var(--amber)' }}>
 {score}/{total}
 </div>
 <div style={{ fontSize:16, color:'var(--text2)', marginTop:4 }}>
 {passed ? `Level ${activeLevel} complete!` : `${LEVELS[String(activeLevel)]?.passScore || 4}/5 needed to pass`}
 </div>
 {xpEarned > 0 && (
 <div style={{ fontSize:20, color:'var(--indigo)', fontFamily:'JetBrains Mono',
 fontWeight:700, marginTop:8 }}>+{xpEarned} XP</div>
 )}
 </div>

 {/* Question breakdown */}
 <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
 {(results.results || []).map((r, i) => (
 <div key={i} className="card" style={{
 borderColor: r.is_correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
 background: r.is_correct ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
 }}>
 <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:10 }}>
 <span style={{ fontSize:18, flexShrink:0 }}>{r.is_correct ? '' : ''}</span>
 <div style={{ flex:1 }}>
 <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>{r.question}</div>
 <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
 <span style={{ fontSize:12, color:'var(--text2)' }}>
 Your answer: <strong style={{ color: r.is_correct ? 'var(--green)' : 'var(--red)',
 fontFamily:'JetBrains Mono' }}>{r.user_answer}</strong>
 </span>
 {!r.is_correct && (
 <span style={{ fontSize:12, color:'var(--text2)' }}>
 Correct: <strong style={{ color:'var(--green)',
 fontFamily:'JetBrains Mono' }}>{r.correct}</strong>
 </span>
 )}
 </div>
 </div>
 </div>
 <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6,
 padding:'10px 12px', background:'rgba(255,255,255,0.03)',
 borderRadius:8, borderLeft:`3px solid ${r.is_correct ? 'var(--green)' : 'var(--red)'}` }}>
 {r.explanation}
 </div>
 </div>
 ))}
 </div>

 {/* Actions */}
 <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
 {passed && parseInt(activeLevel) < 5 && (
 <button className="btn btn-primary"
 onClick={() => { setPhase('levels'); setQuestions([]); setAnswers({}); setResults(null) }}>
 Next Level →
 </button>
 )}
 <button className="btn btn-outline" disabled={txBusy} onClick={retryQuiz}>
 {txBusy ? <><span className="spin-el"/>...</> : '↺ Retry Quiz'}
 </button>
 <button className="btn btn-ghost"
 onClick={() => { setPhase('levels'); setQuestions([]); setAnswers({}); setResults(null) }}>
 Back to Levels
 </button>
 </div>
 </div>
 )
 }

 return null
}
