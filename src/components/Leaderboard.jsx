import { LEVELS, sh } from '../lib/config.js'


function Stat({ label, value }) {
  return (
    <div className="card" style={{
      padding:'18px 20px',
      textAlign:'center',
    }}>
      <div style={{
        fontFamily:'JetBrains Mono',
        fontSize:21,
        fontWeight:800,
        color:'#A5B4FC',
        marginBottom:5,
      }}>
        {value}
      </div>

      <div style={{
        color:'var(--text2)',
        fontSize:11,
        fontFamily:'JetBrains Mono',
        letterSpacing:'0.4px',
      }}>
        {label}
      </div>
    </div>
  )
}


export default function Leaderboard({
  player,
  account,
  connected,
}) {
  if (!connected || !player) {
    return (
      <div style={{
        maxWidth:640,
        margin:'0 auto',
        textAlign:'center',
        padding:'70px 20px',
      }}>
        <div style={{
          fontFamily:'JetBrains Mono',
          fontSize:18,
          fontWeight:700,
          marginBottom:8,
        }}>
          Connect wallet to view your progress
        </div>

        <div style={{
          color:'var(--text2)',
          fontSize:13,
        }}>
          Your GenHunt training stats are stored on GenLayer.
        </div>
      </div>
    )
  }

  const level = player.level || 1
  const completed = player.levels_completed || []
  const answered = player.total_answered || 0
  const correct = player.total_correct || 0

  const accuracy = answered > 0
    ? Math.round((correct / answered) * 100)
    : 0

  return (
    <div style={{
      maxWidth:720,
      margin:'0 auto',
    }}>
      <div style={{ marginBottom:32 }}>
        <div style={{
          fontSize:12,
          color:'var(--text2)',
          fontFamily:'JetBrains Mono',
          marginBottom:8,
          letterSpacing:'0.5px',
        }}>
          PROGRESS BOARD
        </div>

        <h2 style={{
          fontSize:28,
          fontWeight:800,
          letterSpacing:'-0.5px',
        }}>
          Your Training Record
        </h2>

        <p style={{
          color:'var(--text2)',
          marginTop:8,
          fontSize:14,
        }}>
          On-chain progress from your GenHunt training.
        </p>
      </div>


      <div className="card" style={{
        marginBottom:14,
        borderColor:'rgba(99,102,241,0.2)',
      }}>
        <div className="lb-row me">
          <div style={{
            width:42,
            height:42,
            borderRadius:10,
            background:'rgba(99,102,241,0.1)',
            border:'1px solid rgba(99,102,241,0.2)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            fontFamily:'JetBrains Mono',
            fontWeight:800,
            color:'var(--indigo)',
            flexShrink:0,
          }}>
            {level}
          </div>

          <div style={{ flex:1 }}>
            <div style={{
              fontFamily:'JetBrains Mono',
              fontWeight:700,
              fontSize:15,
            }}>
              {player.username || sh(account)}
            </div>

            <div style={{
              fontSize:12,
              color:'var(--text2)',
              marginTop:3,
            }}>
              Level {level} · {
                LEVELS[String(level)]?.name
              }
            </div>
          </div>

          <div style={{ textAlign:'right' }}>
            <div style={{
              fontFamily:'JetBrains Mono',
              fontWeight:800,
              color:'#A5B4FC',
              fontSize:16,
            }}>
              {(player.xp || 0).toLocaleString()} XP
            </div>

            <div style={{
              fontSize:10,
              color:'var(--text2)',
              marginTop:3,
            }}>
              ON-CHAIN
            </div>
          </div>
        </div>
      </div>


      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(2, minmax(0, 1fr))',
        gap:10,
        marginBottom:18,
      }}>
        <Stat
          label="LEVELS CLEARED"
          value={`${completed.length}/8`}
        />

        <Stat
          label="ACCURACY"
          value={`${accuracy}%`}
        />

        <Stat
          label="CORRECT ANSWERS"
          value={correct}
        />

        <Stat
          label="BEST STREAK"
          value={player.best_streak || 0}
        />
      </div>


      <div className="card">
        <div style={{
          fontSize:11,
          color:'var(--text2)',
          fontFamily:'JetBrains Mono',
          marginBottom:16,
          letterSpacing:'0.5px',
        }}>
          LEVEL PROGRESS
        </div>

        <div style={{
          display:'flex',
          flexDirection:'column',
          gap:9,
        }}>
          {Object.entries(LEVELS).map(
            ([number, levelInfo]) => {
              const done = completed.includes(number)
              const current =
                parseInt(number) === level && !done

              return (
                <div
                  key={number}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:12,
                    padding:'11px 13px',
                    borderRadius:9,
                    background:
                      done
                        ? `${levelInfo.color}08`
                        : 'rgba(255,255,255,0.02)',
                    border:
                      done
                        ? `1px solid ${levelInfo.color}20`
                        : '1px solid rgba(255,255,255,0.05)',
                    opacity:
                      parseInt(number) > level && !done
                        ? 0.45
                        : 1,
                  }}
                >
                  <div style={{
                    width:27,
                    height:27,
                    borderRadius:7,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    fontFamily:'JetBrains Mono',
                    fontWeight:700,
                    fontSize:11,
                    color:
                      done
                        ? levelInfo.color
                        : 'var(--text2)',
                    border:
                      `1px solid ${levelInfo.color}30`,
                  }}>
                    {done ? '✓' : number}
                  </div>

                  <div style={{ flex:1 }}>
                    <div style={{
                      fontSize:13,
                      fontWeight:700,
                    }}>
                      {levelInfo.name}
                    </div>

                    <div style={{
                      fontSize:11,
                      color:'var(--text2)',
                      marginTop:2,
                    }}>
                      {levelInfo.topic}
                    </div>
                  </div>

                  <div style={{
                    fontFamily:'JetBrains Mono',
                    fontSize:10,
                    color:
                      done
                        ? levelInfo.color
                        : current
                          ? 'var(--indigo)'
                          : 'var(--text2)',
                  }}>
                    {
                      done
                        ? 'CLEARED'
                        : current
                          ? 'CURRENT'
                          : parseInt(number) > level
                            ? 'LOCKED'
                            : ''
                    }
                  </div>
                </div>
              )
            }
          )}
        </div>
      </div>


      <div style={{
        marginTop:14,
        textAlign:'center',
        color:'rgba(148,163,184,0.45)',
        fontSize:11,
        lineHeight:1.6,
      }}>
        Global rankings are not enabled in this contract version.
        Progress shown here comes directly from your wallet's
        GenLayer state.
      </div>
    </div>
  )
}
