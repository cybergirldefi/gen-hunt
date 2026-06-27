import { useState, useEffect, useRef } from 'react'
import { readContract, writeContract, waitTx } from '../lib/gl.js'
import { CONTRACT_ADDR, LEVELS, sh } from '../lib/config.js'

const QUESTION_TIME = 30 // seconds per question

export default function HuntMode({ account, connected, player, notify, loadPlayer, txBusy, setTxBusy }) {
  const [phase,     setPhase]     = useState('lobby')   // lobby | create | waiting | active | results
  const [roomId,    setRoomId]    = useState('')
  const [room,      setRoom]      = useState(null)
  const [joinInput, setJoinInput] = useState('')
  const [roomName,  setRoomName]  = useState('')
  const [topicLvl,  setTopicLvl]  = useState('1')
  const [answers,   setAnswers]   = useState([])        // player's selected answers
  const [qIndex,    setQIndex]    = useState(0)
  const [timeLeft,  setTimeLeft]  = useState(QUESTION_TIME)
  const [startTime, setStartTime] = useState(null)
  const timerRef = useRef(null)
  const pollRef  = useRef(null)

  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current) }
  const stopPoll  = () => { if (pollRef.current)  clearInterval(pollRef.current)  }

  useEffect(() => () => { stopTimer(); stopPoll() }, [])

  const pollRoom = async (rid) => {
    try {
      const raw = await readContract(CONTRACT_ADDR, 'get_hunt_room', [rid])
      if (raw && raw !== 'NOT_FOUND') {
        const r = JSON.parse(raw)
        setRoom(r)
        if (r.status === 'ACTIVE'   && phase !== 'active')   { setPhase('active'); startQuiz(r) }
        if (r.status === 'FINISHED' && phase !== 'results')  { setPhase('results'); stopPoll(); stopTimer() }
      }
    } catch(e) {}
  }

  const startPoll = (rid) => {
    stopPoll()
    pollRef.current = setInterval(() => pollRoom(rid), 4000)
  }

  const startQuiz = (r) => {
    setQIndex(0)
    setAnswers(Array(r.questions?.length || 10).fill(null))
    setTimeLeft(QUESTION_TIME)
    setStartTime(Date.now())
    startTimer()
  }

  const startTimer = () => {
    stopTimer()
    setTimeLeft(QUESTION_TIME)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          stopTimer()
          // Auto-advance to next question
          setQIndex(i => i + 1)
          setTimeLeft(QUESTION_TIME)
          startTimer()
          return QUESTION_TIME
        }
        return t - 1
      })
    }, 1000)
  }

  const selectAnswer = (answer) => {
    setAnswers(prev => {
      const next = [...prev]
      next[qIndex] = answer
      return next
    })
    // Move to next question automatically after short delay
    stopTimer()
    setTimeout(() => {
      if (qIndex < (room?.questions?.length || 10) - 1) {
        setQIndex(i => i + 1)
        setTimeLeft(QUESTION_TIME)
        startTimer()
      } else {
        // All answered — submit
        handleSubmit()
      }
    }, 800)
  }

  const handleSubmit = async () => {
    stopTimer()
    const timeTaken = Date.now() - (startTime || Date.now())
    // Fill nulls with 'A' (unanswered)
    const finalAnswers = answers.map(a => a || 'A')
    setTxBusy(true)
    try {
      const hash = await writeContract(CONTRACT_ADDR, account, 'submit_hunt_answers', [
        roomId,
        JSON.stringify(finalAnswers),
        String(timeTaken),
      ])
      notify('Submitting answers...', 'inf')
      await waitTx(hash, () => notify('Finalising...', 'inf'))
      notify('Answers submitted! Waiting for others...', 'ok')
      await pollRoom(roomId)
    } catch(e) {
      notify(e.message || 'Submit failed', 'err')
    } finally {
      setTxBusy(false)
    }
  }

  if (!connected) {
    return (
      <div style={{ textAlign:'center', padding:'80px 0' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚔</div>
        <div style={{ fontSize:18, fontWeight:700, fontFamily:'JetBrains Mono' }}>Connect wallet to Hunt</div>
      </div>
    )
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div style={{ maxWidth:640, margin:'0 auto' }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:8 }}>HUNT MODE</div>
        <h2 style={{ fontSize:28, fontWeight:800, fontFamily:'JetBrains Mono' }}>⚔ Enter the Arena</h2>
        <p style={{ color:'var(--muted)', marginTop:8 }}>Same 10 questions for everyone. Most correct + fastest wins.</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:32 }}>
        <div className="card" style={{ cursor:'pointer', borderColor:'rgba(245,158,11,0.3)' }}
             onClick={() => setPhase('create')}>
          <div style={{ fontSize:28, marginBottom:8 }}>🏟</div>
          <div style={{ fontWeight:700, fontFamily:'JetBrains Mono', marginBottom:4 }}>Create Hunt</div>
          <div style={{ fontSize:13, color:'var(--muted)' }}>Host a room, invite friends, start when ready.</div>
        </div>
        <div className="card" style={{ cursor:'pointer', borderColor:'rgba(6,182,212,0.3)' }}
             onClick={() => setPhase('join')}>
          <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
          <div style={{ fontWeight:700, fontFamily:'JetBrains Mono', marginBottom:4 }}>Join Hunt</div>
          <div style={{ fontSize:13, color:'var(--muted)' }}>Enter a room ID and jump in.</div>
        </div>
      </div>

      <div className="card" style={{ borderColor:'rgba(6,182,212,0.15)' }}>
        <div style={{ fontSize:12, color:'var(--cyan)', fontFamily:'JetBrains Mono', marginBottom:12 }}>HOW IT WORKS</div>
        {[
          ['1', 'Host creates a room and AI generates 10 questions'],
          ['2', 'Players join using the Room ID'],
          ['3', 'Host starts when ready (min 2 players)'],
          ['4', 'Everyone answers the same questions — 30s per question'],
          ['5', 'Most correct + fastest time wins — results on-chain'],
        ].map(([n,t]) => (
          <div key={n} style={{ display:'flex', gap:12, marginBottom:10, alignItems:'flex-start' }}>
            <span style={{ width:24, height:24, borderRadius:6, background:'rgba(6,182,212,0.1)',
              border:'1px solid rgba(6,182,212,0.2)', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:11, fontFamily:'JetBrains Mono', color:'var(--cyan)',
              flexShrink:0 }}>{n}</span>
            <span style={{ fontSize:14, color:'var(--muted)', lineHeight:1.5 }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )

  // ── Join ──────────────────────────────────────────────────────────────────
  if (phase === 'join') return (
    <div style={{ maxWidth:480, margin:'0 auto' }}>
      <button className="btn btn-outline" style={{ marginBottom:24 }} onClick={() => setPhase('lobby')}>← Back</button>
      <div className="card">
        <div style={{ fontWeight:700, fontFamily:'JetBrains Mono', fontSize:18, marginBottom:20 }}>Join a Hunt</div>
        <label style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', display:'block', marginBottom:6 }}>ROOM ID</label>
        <input className="input mono" placeholder="e.g. r42" value={joinInput}
               onChange={e => setJoinInput(e.target.value.trim())} style={{ marginBottom:16 }} />
        <button className="btn btn-cyan" style={{ width:'100%' }} disabled={txBusy || !joinInput}
                onClick={async () => {
                  setTxBusy(true)
                  try {
                    const hash = await writeContract(CONTRACT_ADDR, account, 'join_hunt', [joinInput])
                    notify('Joining Hunt...', 'inf')
                    await waitTx(hash)
                    setRoomId(joinInput)
                    await pollRoom(joinInput)
                    setPhase('waiting')
                    startPoll(joinInput)
                    notify('Joined! Waiting for host to start...', 'ok')
                  } catch(e) {
                    notify(e.message, 'err')
                  } finally {
                    setTxBusy(false)
                  }
                }}>
          {txBusy ? <><span className="spin-el"/>Joining...</> : '→ Join Hunt'}
        </button>
      </div>
    </div>
  )

  // ── Create ────────────────────────────────────────────────────────────────
  if (phase === 'create') return (
    <div style={{ maxWidth:480, margin:'0 auto' }}>
      <button className="btn btn-outline" style={{ marginBottom:24 }} onClick={() => setPhase('lobby')}>← Back</button>
      <div className="card">
        <div style={{ fontWeight:700, fontFamily:'JetBrains Mono', fontSize:18, marginBottom:20 }}>Create a Hunt</div>
        <label style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', display:'block', marginBottom:6 }}>ROOM NAME</label>
        <input className="input" placeholder="e.g. Friday Night Hack" value={roomName}
               onChange={e => setRoomName(e.target.value)} style={{ marginBottom:16 }} />
        <label style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', display:'block', marginBottom:6 }}>DIFFICULTY LEVEL</label>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:20 }}>
          {['1','2','3','4','5'].map(l => (
            <button key={l} className="btn"
                    style={{ padding:'8px 0', justifyContent:'center',
                      border:`1px solid ${topicLvl===l ? LEVELS[l].color : 'rgba(255,255,255,0.1)'}`,
                      background: topicLvl===l ? `${LEVELS[l].color}15` : 'transparent',
                      color: topicLvl===l ? LEVELS[l].color : 'var(--muted)', fontSize:12 }}
                    onClick={() => setTopicLvl(l)}>
              {LEVELS[l].name}
            </button>
          ))}
        </div>
        <div className="card" style={{ background:'var(--bg3)', marginBottom:20, padding:'12px 16px' }}>
          <div style={{ fontSize:12, color:'var(--muted)' }}>
            Topic: <span style={{ color: LEVELS[topicLvl].color }}>{LEVELS[topicLvl].topic}</span>
          </div>
        </div>
        <button className="btn btn-primary" style={{ width:'100%' }}
                disabled={txBusy || !roomName.trim() || !player?.username}
                onClick={async () => {
                  if (!player?.username) { notify('Set a username first', 'err'); return }
                  setTxBusy(true)
                  try {
                    const hash = await writeContract(CONTRACT_ADDR, account, 'create_hunt', [roomName.trim(), topicLvl], 0n, true)
                    notify('AI generating 10 questions...', 'inf')
                    await waitTx(hash, () => notify('This may take a moment...', 'inf'))
                    // Get room ID (latest)
                    await new Promise(r => setTimeout(r, 2000))
                    // Poll for room - find latest room
                    notify('Hunt created!', 'ok')
                    // We don't know the room_id easily — ask user to share
                    setPhase('waiting')
                    // TODO: better room ID discovery
                  } catch(e) {
                    notify(e.message, 'err')
                  } finally {
                    setTxBusy(false)
                  }
                }}>
          {txBusy ? <><span className="spin-el"/>Creating...</> : '⚔ Create Hunt'}
        </button>
        {!player?.username && (
          <div style={{ fontSize:12, color:'var(--red)', marginTop:8, textAlign:'center' }}>
            You need a username to create a Hunt
          </div>
        )}
      </div>
    </div>
  )

  // ── Waiting ───────────────────────────────────────────────────────────────
  if (phase === 'waiting') return (
    <div style={{ maxWidth:480, margin:'0 auto', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
      <div style={{ fontFamily:'JetBrains Mono', fontSize:20, fontWeight:700, marginBottom:8 }}>Waiting for players</div>
      <div style={{ color:'var(--muted)', marginBottom:24 }}>Room ID: <span className="mono" style={{ color:'#A5B4FC' }}>{roomId}</span></div>
      {room && (
        <div className="card" style={{ textAlign:'left', marginBottom:20 }}>
          <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:12 }}>PLAYERS IN ROOM</div>
          {Object.entries(room.players || {}).map(([addr, info]) => (
            <div key={addr} className="lb-row" style={{ padding:'8px 0' }}>
              <div className="pulse-dot" />
              <span style={{ fontFamily:'JetBrains Mono', fontSize:14 }}>{info.username || sh(addr)}</span>
              {addr === account && <span style={{ marginLeft:'auto', fontSize:11, color:'#A5B4FC' }}>YOU</span>}
              {addr === room.host && <span style={{ marginLeft:8, fontSize:11, color:'var(--cyan)' }}>HOST</span>}
            </div>
          ))}
        </div>
      )}
      {room?.host === account && (
        <button className="btn btn-primary" disabled={txBusy || Object.keys(room?.players||{}).length < 2}
                onClick={async () => {
                  setTxBusy(true)
                  try {
                    const hash = await writeContract(CONTRACT_ADDR, account, 'start_hunt', [roomId])
                    await waitTx(hash)
                    await pollRoom(roomId)
                  } catch(e) { notify(e.message, 'err') } finally { setTxBusy(false) }
                }}>
          ⚔ Start Hunt ({Object.keys(room?.players||{}).length}/10 players)
        </button>
      )}
    </div>
  )

  // ── Active Quiz ───────────────────────────────────────────────────────────
  if (phase === 'active' && room) {
    const questions  = room.questions || []
    const q          = questions[qIndex]
    const total      = questions.length
    const isAnswered = answers[qIndex] !== null
    const allDone    = answers.every(a => a !== null)

    if (allDone && !txBusy) {
      return (
        <div style={{ textAlign:'center', padding:'60px 20px' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
          <div style={{ fontFamily:'JetBrains Mono', fontSize:20, fontWeight:700, marginBottom:8 }}>All answered!</div>
          <div style={{ color:'var(--muted)', marginBottom:24 }}>Waiting for other players...</div>
          <span className="spin-el" style={{ width:32, height:32, borderWidth:3, color:'var(--cyan)' }} />
        </div>
      )
    }

    return (
      <div style={{ maxWidth:680, margin:'0 auto' }}>
        {/* Progress + timer */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:6 }}>
              Question {qIndex+1} of {total}
            </div>
            <div className="progress-bar">
              {Array(total).fill(0).map((_,i) => (
                <div key={i} className={`progress-seg ${
                  i < qIndex ? 'done' :
                  i === qIndex ? 'active' : ''
                }`} />
              ))}
            </div>
          </div>
          {/* Timer */}
          <div style={{ position:'relative', width:56, height:56, flexShrink:0 }}>
            <svg width="56" height="56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
              <circle cx="28" cy="28" r="24" fill="none"
                stroke={timeLeft > 10 ? 'var(--cyan)' : 'var(--red)'}
                strokeWidth="4"
                strokeDasharray={`${2*Math.PI*24}`}
                strokeDashoffset={`${2*Math.PI*24 * (1 - timeLeft/QUESTION_TIME)}`}
                strokeLinecap="round"
                style={{ transition:'stroke-dashoffset 1s linear', transform:'rotate(-90deg)', transformOrigin:'center' }}
              />
            </svg>
            <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
              justifyContent:'center', fontFamily:'JetBrains Mono', fontWeight:700,
              fontSize:16, color: timeLeft > 10 ? 'var(--text)' : 'var(--red)' }}>
              {timeLeft}
            </span>
          </div>
        </div>

        {/* Question */}
        {q && (
          <>
            <div className="card decrypt" style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:12 }}>▸ QUESTION</div>
              <div style={{ fontSize:17, fontWeight:600, lineHeight:1.6 }}>{q.question}</div>
            </div>
            <div className="answer-grid">
              {['A','B','C','D'].map(opt => (
                <button key={opt}
                  className={`answer-btn${answers[qIndex]===opt ? ' selected' : ''}`}
                  disabled={isAnswered || txBusy}
                  onClick={() => selectAnswer(opt)}>
                  <span className="answer-key">{opt}</span>
                  <span>{q.options?.[opt]}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (phase === 'results' && room) {
    const scores = room.scores || {}
    const sorted = Object.entries(scores).sort(([,a],[,b]) => b-a)
    const winner = room.winner

    return (
      <div style={{ maxWidth:640, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🏆</div>
          <div style={{ fontFamily:'JetBrains Mono', fontSize:28, fontWeight:800, color:'#A5B4FC' }}>
            Hunt Complete!
          </div>
          {winner && (
            <div style={{ marginTop:8, fontSize:16, color:'var(--muted)' }}>
              Winner: <span style={{ color:'#A5B4FC', fontFamily:'JetBrains Mono', fontWeight:700 }}>
                {room.players?.[winner]?.username || sh(winner)}
              </span>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono', marginBottom:16 }}>FINAL STANDINGS</div>
          {sorted.map(([addr, score], i) => {
            const sub = room.submissions?.[addr] || {}
            const isWinner = addr === winner
            const isMe     = addr === account
            return (
              <div key={addr} className={`lb-row${isMe?' me':''}`} style={{ marginBottom:4 }}>
                <span style={{ fontSize:18, fontFamily:'JetBrains Mono', fontWeight:700, width:28,
                  color: i===0 ? '#FFD700' : i===1 ? '#C0C0C0' : i===2 ? '#CD7F32' : 'var(--muted)' }}>
                  {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}
                </span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:600 }}>
                    {room.players?.[addr]?.username || sh(addr)}
                    {isWinner && <span style={{ marginLeft:8, fontSize:11, color:'#A5B4FC' }}>WINNER</span>}
                    {isMe     && <span style={{ marginLeft:8, fontSize:11, color:'var(--cyan)'  }}>YOU</span>}
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>
                    {sub.correct || 0}/10 correct · {((sub.time_ms||0)/1000).toFixed(1)}s
                  </div>
                </div>
                <span style={{ fontFamily:'JetBrains Mono', fontWeight:700, color: i===0 ? 'var(--indigo)' : 'var(--text)' }}>
                  {score}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop:20, display:'flex', gap:12, justifyContent:'center' }}>
          <button className="btn btn-primary" onClick={() => { setPhase('lobby'); setRoom(null); setRoomId('') }}>
            Play Again
          </button>
        </div>
      </div>
    )
  }

  return null
}
