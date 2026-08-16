import { useState, useEffect } from 'react'
import { readContract, writeContract, waitTx, clearReadCache } from '../lib/gl.js'
import { CONTRACT_ADDR, LEVELS } from '../lib/config.js'
import { LevelIcon, ScoreRing } from '../App.jsx'
import Mascot from './Mascot.jsx'

const LEVEL_TOPICS = {
  '1':'Basic Web3 Safety', '2':'Wallets & Keys', '3':'DeFi & Rug Pulls',
  '4':'Smart Contract Vulns', '5':'Advanced Exploits', '6':'Zero-day & Side-channels',
  '7':'Social Engineering & OSINT', '8':'Nation-state & APT Attacks',
}

function parseContractValue(value) {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  return value
}

function progressKey(account, level) {
  return `genhunt:quiz:${String(account).toLowerCase()}:${level}`
}

function saveQuizProgress(account, level, data) {
  if (!account || !level) return

  try {
    localStorage.setItem(
      progressKey(account, level),
      JSON.stringify(data),
    )
  } catch {}
}

function loadQuizProgress(account, level) {
  if (!account || !level) return null

  try {
    const raw = localStorage.getItem(
      progressKey(account, level),
    )

    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearQuizProgress(account, level) {
  if (!account || !level) return

  try {
    localStorage.removeItem(
      progressKey(account, level),
    )
  } catch {}
}


async function loadQuestionsByIds(ids) {
  return Promise.all(
    ids.map(async qid => {
      const raw = await readContract(
        CONTRACT_ADDR,
        'get_question',
        [qid],
      )

      if (!raw || raw === 'NOT_FOUND') {
        throw new Error(
          `Question ${qid} could not be loaded`
        )
      }

      const parsed = parseContractValue(raw)

      if (!parsed || typeof parsed !== 'object') {
        throw new Error(
          `Invalid question ${qid}`
        )
      }

      return parsed
    }),
  )
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
  const [resumeChecking, setResumeChecking] = useState(true)
  const [activeQuizLevel, setActiveQuizLevel] = useState(null)
  const [practiceMode, setPracticeMode] = useState(false)
  const [openingLevel, setOpeningLevel] = useState(null)

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

  const restoreActiveQuiz = async (level) => {
    const levelString = String(level)

    const rawStatus = await readContract(
      CONTRACT_ADDR,
      'get_quiz_status',
      [account, levelString],
    )

    const status = parseContractValue(rawStatus)

    if (
      !status ||
      status === 'NOT_FOUND' ||
      status.status !== 'IN_PROGRESS' ||
      !Array.isArray(status.q_ids) ||
      status.q_ids.length !== 5
    ) {
      return false
    }

    const qs = await loadQuestionsByIds(
      status.q_ids,
    )

    const saved = loadQuizProgress(
      account,
      levelString,
    )

    const sameQuiz =
      saved &&
      Array.isArray(saved.qIds) &&
      JSON.stringify(saved.qIds) ===
        JSON.stringify(status.q_ids)

    const restoredAnswers =
      sameQuiz && saved.answers
        ? saved.answers
        : {}

    let restoredQuestion =
      sameQuiz &&
      Number.isInteger(saved.currentQ)
        ? saved.currentQ
        : Object.keys(restoredAnswers).length

    restoredQuestion = Math.max(
      0,
      Math.min(
        restoredQuestion,
        qs.length - 1,
      ),
    )

    setPracticeMode(false)
    setActiveLevel(parseInt(levelString))
    setActiveQuizLevel(parseInt(levelString))
    setQIds(status.q_ids)
    setQuestions(qs)
    setAnswers(restoredAnswers)
    setCurrentQ(restoredQuestion)
    setPhase('quiz')

    notify(
      Object.keys(restoredAnswers).length > 0
        ? `Resumed Level ${levelString} at Question ${restoredQuestion + 1}`
        : `Resumed active Level ${levelString} quiz`,
      'inf',
    )

    return true
  }


  // Detect unfinished quizzes in the background.
  // The level screen stays interactive immediately.
  useEffect(() => {
    if (!connected || !account || !CONTRACT_ADDR) {
      setResumeChecking(false)
      setActiveQuizLevel(null)
      return
    }

    let cancelled = false

    const checkResume = async () => {
      /*
       * Do not block level interaction while checking.
       * All eight status reads run concurrently.
       */
      setResumeChecking(false)

      const levels = Object.keys(LEVELS)

      const checks = await Promise.all(
        levels.map(async level => {
          try {
            const rawStatus = await readContract(
              CONTRACT_ADDR,
              'get_quiz_status',
              [account, level],
            )

            const status = parseContractValue(rawStatus)

            if (
              status &&
              status !== 'NOT_FOUND' &&
              status.status === 'IN_PROGRESS' &&
              Array.isArray(status.q_ids) &&
              status.q_ids.length === 5
            ) {
              return parseInt(level)
            }
          } catch {}

          return null
        }),
      )

      if (cancelled) return

      const active = checks.find(
        level => level !== null
      )

      setActiveQuizLevel(active || null)
    }

    checkResume()

    return () => {
      cancelled = true
    }
  }, [connected, account])


  const generateQuiz = async (level) => {
    if (resumeChecking) {
      notify(
        'Checking for an unfinished quiz...',
        'inf',
      )
      return
    }

    setTxBusy(true)

    let msgInterval

    try {
      /*
       * Critical:
       * Never request a new generation transaction when this
       * wallet already has an active quiz for the level.
       */
      clearReadCache()

      const restored =
        await restoreActiveQuiz(level)

      if (restored) {
        setTxBusy(false)
        return
      }

      setPracticeMode(false)
      setPhase('generating')
      setActiveLevel(level)
      setAnswers({})
      setCurrentQ(0)
      setResults(null)
      setGenMsg('AI is writing your quiz...')

      /*
       * Full consensus is required because the contract invokes
       * prompt_non_comparative.
       */
      const hash = await writeContract(
        CONTRACT_ADDR,
        account,
        'request_level_quiz',
        [String(level)],
        0n,
        false,
      )

      notify('Generating questions...', 'inf')

      let tick = 0

      const msgs = [
        'AI is writing your quiz...',
        'Validators are reviewing the questions...',
        'Checking answer quality...',
        'Almost there...',
      ]

      msgInterval = setInterval(() => {
        tick = (tick + 1) % msgs.length
        setGenMsg(msgs[tick])
      }, 5000)

      await waitTx(
        hash,
        () => notify(
          'GenLayer validators are still reaching consensus...',
          'inf',
        ),
      )

      clearReadCache()

      /*
       * Only now do we know a genuinely new quiz was accepted.
       * Safe to discard local progress from an older quiz.
       */
      clearQuizProgress(
        account,
        String(level),
      )

      const rawStatus = await pollUntil(async () => {
        const raw = await readContract(
          CONTRACT_ADDR,
          'get_quiz_status',
          [account, String(level)],
        )

        const parsed = parseContractValue(raw)

        if (
          parsed &&
          parsed.status === 'IN_PROGRESS' &&
          Array.isArray(parsed.q_ids) &&
          parsed.q_ids.length === 5
        ) {
          return parsed
        }

        return null
      })

      const ids = rawStatus.q_ids
      const qs = await loadQuestionsByIds(ids)

      setActiveQuizLevel(parseInt(level))
      setQIds(ids)
      setQuestions(qs)
      setAnswers({})
      setCurrentQ(0)

      saveQuizProgress(
        account,
        String(level),
        {
          qIds: ids,
          answers: {},
          currentQ: 0,
        },
      )

      setPhase('quiz')

      notify('Questions ready', 'ok')
    } catch (error) {
      /*
       * Wallet rejection must NOT destroy an already existing
       * on-chain/local quiz.
       */
      if (
        error?.code === 4001 ||
        /user rejected/i.test(error?.message || '')
      ) {
        notify('Transaction cancelled', 'inf')

        clearReadCache()

        try {
          const restored =
            await restoreActiveQuiz(level)

          if (!restored) {
            setPhase('levels')
          }
        } catch {
          setPhase('levels')
        }

        return
      }

      notify(
        error.message || 'Failed to generate quiz',
        'err',
      )

      /*
       * Before falling back to the level screen, check whether
       * the transaction actually created/left an active quiz.
       */
      clearReadCache()

      try {
        const restored =
          await restoreActiveQuiz(level)

        if (!restored) {
          setPhase('levels')
        }
      } catch {
        setPhase('levels')
      }
    } finally {
      if (msgInterval) {
        clearInterval(msgInterval)
      }

      setTxBusy(false)
    }
  }


  const selectAnswer = (answer) => {
    if (answers[currentQ] !== undefined) return

    const newAnswers = {
      ...answers,
      [currentQ]: answer,
    }

    const nextQuestion =
      currentQ < questions.length - 1
        ? currentQ + 1
        : currentQ

    setAnswers(newAnswers)

    if (!practiceMode) {
      saveQuizProgress(
        account,
        String(activeLevel),
        {
          qIds,
          answers: newAnswers,
          currentQ: nextQuestion,
        },
      )
    }

    if (currentQ < questions.length - 1) {
      setTimeout(() => {
        setCurrentQ(nextQuestion)
      }, 500)
    }
  }


  const submitAnswers = async () => {
    if (Object.keys(answers).length < questions.length) {
      notify('Answer all questions first', 'err')
      return
    }

    /*
     * Practice Mode never writes to the contract.
     * It reuses a previously completed on-chain quiz and scores
     * the attempt locally with zero XP/progression effects.
     */
    if (practiceMode) {
      const practiceResults = questions.map(
        (question, index) => {
          const userAnswer = answers[index]
          const correctAnswer = String(
            question.correct
          ).toUpperCase()

          return {
            q_id: question.id || qIds[index],
            question: question.question,
            user_answer: userAnswer,
            correct: correctAnswer,
            is_correct:
              userAnswer === correctAnswer,
            explanation:
              question.explanation || '',
          }
        },
      )

      const score = practiceResults.filter(
        result => result.is_correct
      ).length

      const passScore =
        LEVELS[String(activeLevel)]?.passScore || 4

      setResults({
        status: 'PRACTICE_COMPLETED',
        q_ids: qIds,
        score,
        passed: score >= passScore,
        xp_earned: 0,
        results: practiceResults,
      })

      setPhase('results')
      return
    }

    if (Object.keys(answers).length < questions.length) {
      notify('Answer all questions first', 'err')
      return
    }

    setPhase('submitting')
    setTxBusy(true)

    try {
      const hash = await writeContract(
        CONTRACT_ADDR,
        account,
        'submit_quiz_answers',
        [
          String(activeLevel),
          JSON.stringify(answers),
        ],
        0n,
        true,
      )

      notify('Scoring your answers...', 'inf')

      await waitTx(
        hash,
        () => notify('Finalising score...', 'inf'),
      )

      clearReadCache()

      const statusRaw = await pollUntil(async () => {
        const raw = await readContract(
          CONTRACT_ADDR,
          'get_quiz_status',
          [account, String(activeLevel)],
        )

        if (!raw) return null

        const status =
          typeof raw === 'string'
            ? JSON.parse(raw)
            : raw

        return status.status === 'COMPLETED'
          ? status
          : null
      })

      setResults(statusRaw)

      clearQuizProgress(
        account,
        String(activeLevel),
      )

      setActiveQuizLevel(null)

      await loadPlayer(account)

      setPhase('results')
    } catch (error) {
      notify(
        error.message || 'Submit failed',
        'err',
      )

      setPhase('quiz')
    } finally {
      setTxBusy(false)
    }
  }


  const retryQuiz = async () => {
    setTxBusy(true)

    try {
      const hash = await writeContract(
        CONTRACT_ADDR,
        account,
        'retry_quiz',
        [String(activeLevel)],
        0n,
        true,
      )

      notify('Resetting quiz...', 'inf')

      await waitTx(
        hash,
        () => notify('Finalising reset...', 'inf'),
      )

      clearReadCache()

      clearQuizProgress(
        account,
        String(activeLevel),
      )

      setActiveQuizLevel(null)

      await loadPlayer(account)

      setPhase('levels')
      setQuestions([])
      setQIds([])
      setAnswers({})
      setResults(null)

      notify('Ready for a new attempt', 'ok')
    } catch (error) {
      notify(
        error.message || 'Retry failed',
        'err',
      )
    } finally {
      setTxBusy(false)
    }
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
          const done = completed.includes(l)
          const hasActiveQuiz = activeQuizLevel === parseInt(l)
          const locked = parseInt(l) > currentLevel && !done
          const isCurr =
            String(currentLevel) === l &&
            !done &&
            !hasActiveQuiz
          return (
            <div key={l} className="card" style={{
              borderColor: locked ? 'rgba(255,255,255,0.04)' : `${lvl.color}20`,
              opacity: locked ? 0.35 : 1,
              cursor:
                locked
                  ? 'not-allowed'
                  : 'pointer',
              display:'flex', alignItems:'center', gap:14,
              padding:'16px 20px', transition:'all .2s',
            }}
            onClick={async () => {
              if (
                locked ||
                txBusy ||
                openingLevel
              ) return

              const levelNumber = parseInt(l)

              setOpeningLevel(levelNumber)

              try {
                if (done && !hasActiveQuiz) {
                  await startPractice(levelNumber)
                  return
                }

                await generateQuiz(levelNumber)
              } finally {
                setOpeningLevel(null)
              }
            }}
            onMouseEnter={e => { if(!locked) e.currentTarget.style.transform='translateX(4px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='' }}>
              <LevelIcon level={parseInt(l)} size={40}
                done={done} active={isCurr} locked={locked}/>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span style={{ fontWeight:700, fontFamily:'JetBrains Mono', fontSize:14 }}>
                    Level {l} — {lvl.name}
                  </span>
                  {done && (
                    <>
                      <span
                        className="pill level-1"
                        style={{ fontSize:9, padding:'2px 8px' }}
                      >
                        DONE
                      </span>

                      <span
                        className="pill"
                        style={{
                          fontSize:9,
                          padding:'2px 8px',
                          color:'var(--text2)',
                          border:'1px solid rgba(255,255,255,0.08)',
                          background:'rgba(255,255,255,0.03)',
                        }}
                      >
                        PRACTICE
                      </span>
                    </>
                  )}

                  {hasActiveQuiz && (
                    <span
                      className="pill"
                      style={{
                        fontSize:9,
                        padding:'2px 8px',
                        background:'rgba(99,102,241,0.12)',
                        border:'1px solid rgba(99,102,241,0.35)',
                        color:'var(--indigo)',
                      }}
                    >
                      CONTINUE
                    </span>
                  )}

                  {isCurr && <span className="pill" style={{ fontSize:9, padding:'2px 8px',
                    background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)',
                    color:'var(--indigo)' }}>CURRENT</span>}
                </div>
                <div style={{ fontSize:12, color:'var(--text2)' }}>{LEVEL_TOPICS[l]}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                {openingLevel === parseInt(l) ? (
                  <div style={{
                    fontSize:11,
                    fontFamily:'JetBrains Mono',
                    color:lvl.color,
                    display:'flex',
                    gap:6,
                    alignItems:'center',
                  }}>
                    <span className="spin-el"/>
                    Opening...
                  </div>
                ) : (
                  <>
                    <div style={{
                      fontSize:13,
                      fontFamily:'JetBrains Mono',
                      fontWeight:700,
                      color:lvl.color,
                    }}>
                      +{lvl.xpReward * 5}
                    </div>
                    <div style={{
                      fontSize:10,
                      color:'var(--text2)',
                    }}>
                      XP max
                    </div>
                  </>
                )}
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
                  onClick={() => {
                    setPhase('levels')
                    setQuestions([])
                    setAnswers({})
                    setPracticeMode(false)
                  }}>
            Back
          </button>
          <div style={{
            display:'flex',
            alignItems:'center',
            gap:8,
          }}>
            <span className={`pill level-${Math.min(activeLevel,5)}`}>
              Level {activeLevel} — {LEVELS[String(activeLevel)]?.name}
            </span>

            {practiceMode && (
              <span
                className="pill"
                style={{
                  color:'#A5B4FC',
                  background:'rgba(99,102,241,0.1)',
                  border:'1px solid rgba(99,102,241,0.25)',
                }}
              >
                PRACTICE
              </span>
            )}
          </div>
          <span style={{ fontSize:12, color:'var(--text2)', fontFamily:'JetBrains Mono' }}>
            {Object.keys(answers).length}/5
          </span>
        </div>

        {/* Question number dots */}
        <div style={{ display:'flex', gap:6, marginBottom:24, justifyContent:'center' }}>
          {questions.map((_,i) => (
            <div key={i} onClick={() => {
              setCurrentQ(i)
              saveQuizProgress(
                account,
                String(activeLevel),
                {
                  qIds,
                  answers,
                  currentQ: i,
                },
              )
            }} style={{
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
              {practiceMode
                ? 'Check Answers'
                : txBusy
                  ? <><span className="spin-el"/>Submitting...</>
                  : 'Submit Answers'}
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
            {practiceMode
              ? `Practice score: ${score}/${total}`
              : passed
                ? `Level ${activeLevel} cleared`
                : `Need ${lvl?.passScore || 4}/5 to pass`}
          </div>
          {xpEarned > 0 && (
            <div style={{ fontSize:17, color:'#A5B4FC', fontFamily:'JetBrains Mono',
              fontWeight:700 }}>+{xpEarned} XP</div>
          )}

          {practiceMode && (
            <div style={{
              fontSize:12,
              color:'var(--text2)',
              fontFamily:'JetBrains Mono',
              marginTop:6,
            }}>
              PRACTICE · 0 XP · progression unchanged
            </div>
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
          {!practiceMode && passed && parseInt(activeLevel) < 8 && (
            <button className="btn btn-primary"
                    onClick={() => {
                    setPhase('levels')
                    setQuestions([])
                    setAnswers({})
                    setResults(null)
                    setPracticeMode(false)
                  }}>
              Next Level
            </button>
          )}
          <button
            className="btn btn-outline"
            disabled={txBusy}
            onClick={() => {
              if (practiceMode) {
                startPractice(activeLevel)
              } else {
                retryQuiz()
              }
            }}
          >
            {txBusy
              ? <><span className="spin-el"/>...</>
              : practiceMode
                ? 'Practice Again'
                : 'Retry'}
          </button>
          <button className="btn btn-ghost"
                  onClick={() => {
                    setPhase('levels')
                    setQuestions([])
                    setAnswers({})
                    setResults(null)
                    setPracticeMode(false)
                  }}>
            All Levels
          </button>
        </div>
      </div>
    )
  }

  return null
}
