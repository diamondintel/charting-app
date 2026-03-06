import { useState, useEffect, useCallback, useRef } from 'react'
import AuthScreen from './components/AuthScreen.jsx'
import ResetPasswordScreen from './components/ResetPasswordScreen.jsx'
import { supabase, signOut } from './lib/supabase.js'
import { useToast } from './components/Toast.jsx'
import PitcherScoutingReport from './components/PitcherScoutingReport.jsx'
import OpponentScouting from './components/OpponentScouting.jsx'
import PreGamePrep from './components/PreGamePrep.jsx'
import GameSummary from './components/GameSummary.jsx'
import { exportGameSummaryPDF } from './lib/exportPDF.js'
import { getClaudeRecommendations, generatePostABSummary, TRIGGER_LABELS } from './lib/claudeAI.js'
import './index.css'
import Header from './components/Header'
import LeftPanel from './components/LeftPanel'
import CenterPanel from './components/CenterPanel'
import RightPanel from './components/RightPanel'
import BottomConsole from './components/BottomConsole'
import RosterTab from './components/RosterTab'
import Scorebook from './components/Scorebook'
import MobileLayout from './components/MobileLayout'
import {
  getTeams, getGames, createGame, deleteGame, getSavedOpponentTeams,
  getOpponentLineup, getPlayers, getPitchers,
  createPA, updatePAResult,
  saveHitterNote, getHitterNotes,
  insertPitch, deletePitch,
  getPitchesForGame, getPitchesForPA, getPAsForGame,
  saveGameState, loadGameState,
} from './lib/db'
import {
  advanceCount, computePitchStats, pitchTypeBreakdown, pitchEffectiveness,
  generateSignals, generateRecommendations,
  checkReverseSwitch, computePCI, computeLeverage, computePRR,
  OUTCOME_COLORS, PITCH_COLORS, STRIKE_OUTCOMES, HIT_RESULTS,
} from './lib/analytics'

const DEFAULT_ARSENAL = ['Fastball', 'Changeup', 'Drop']

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

// ─── Resume Game Row — shows saved state inline ───────────────────────────────
function ResumeGameRow({ game, onResume, onDelete }) {
  // game_state is pre-joined from getGames — no extra DB call needed
  const gs = game.game_state   // null if game was never saved

  const isActive = !!gs
  const inningLabel = gs
    ? `INN ${gs.inning} ${gs.top_bottom === 'top' ? '▲' : '▼'}`
    : null
  const scoreLabel = gs ? `${gs.our_runs} – ${gs.opp_runs}` : null

  const savedLabel = gs?.saved_at
    ? (() => {
        const d = new Date(gs.saved_at)
        const now = new Date()
        const diffH = (now - d) / 36e5
        if (diffH < 1)   return `${Math.round(diffH * 60)}m ago`
        if (diffH < 24)  return `${Math.round(diffH)}h ago`
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      })()
    : null

  const borderColor = isActive ? 'rgba(245,166,35,0.5)' : 'var(--border)'
  const bgColor     = isActive ? 'rgba(245,166,35,0.06)' : 'transparent'

  return (
    <div
      onClick={() => onResume(game)}
      style={{
        padding: '10px 12px',
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        marginBottom: 6,
        cursor: 'pointer',
        transition: 'all 0.15s',
        background: bgColor,
        display: 'flex', flexDirection: 'column', gap: 5,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'rgba(245,166,35,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor;   e.currentTarget.style.background = bgColor }}
    >
      {/* Row 1: opponent + date + delete */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 15, color: isActive ? 'var(--gold)' : 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          vs {game.opponent}
        </span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
          {game.game_date}
        </span>
        {onDelete && (
          <button
            onClick={e => onDelete(e, game.game_id)}
            title="Delete game"
            style={{
              flexShrink: 0, width: 18, height: 18, padding: 0, lineHeight: 1,
              background: 'transparent', border: '1px solid transparent',
              color: 'var(--text-dim)', borderRadius: 3, cursor: 'pointer', fontSize: 11,
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'transparent' }}
          >✕</button>
        )}
      </div>

      {/* Row 2: save state badges */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {isActive ? (
          <>
            <span style={{
              fontFamily: "'Share Tech Mono', monospace", fontSize: 8, letterSpacing: 1.5,
              color: 'var(--gold)', background: 'rgba(245,166,35,0.15)',
              border: '1px solid rgba(245,166,35,0.4)',
              borderRadius: 3, padding: '2px 7px',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
              ACTIVE
            </span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1 }}>
              {inningLabel}
            </span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--gold)', letterSpacing: 1 }}>
              {scoreLabel}
            </span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: 'var(--text-dim)', marginLeft: 'auto' }}>
              {savedLabel}
            </span>
          </>
        ) : (
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: 'var(--text-dim)' }}>
            NO SAVE DATA
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
// v2
function SetupScreen({ onGameReady, onSignOut, authUser }) {
  const [teams, setTeams]               = useState([])
  const [games, setGames]               = useState([])
  const [showAllGames, setShowAllGames] = useState(false)
  const [pitchers, setPitchers]         = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedPitcher, setSelectedPitcher] = useState(null)
  const [showScoutingReport, setShowScoutingReport] = useState(false)
  const [showOpponentScouting, setShowOpponentScouting] = useState(false)
  const [showPreGamePrep, setShowPreGamePrep] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [opponent, setOpponent]         = useState('')
  const [customOpponent, setCustomOpponent] = useState('')
  const [savedOpponents, setSavedOpponents] = useState([])
  const [gameDate, setGameDate]         = useState(new Date().toISOString().split('T')[0])
  const [error, setError]               = useState(null)

  useEffect(() => {
    getTeams().then(setTeams).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedTeam) return
    getGames(selectedTeam.team_id).then(gs => setGames([...gs].sort((a,b) => b.game_id - a.game_id))).catch(console.error)  // B-011: newest first
    getPitchers(selectedTeam.team_id).then(ps => {
      setPitchers(ps)
      setSelectedPitcher(ps.length > 0 ? ps[0] : null)
    }).catch(console.error)
    getSavedOpponentTeams(selectedTeam.team_id).then(setSavedOpponents).catch(console.error)
  }, [selectedTeam])

  async function handleCreateGame() {
    if (!selectedTeam || !opponent || (opponent === '__custom__' && !customOpponent.trim())) return
    try {
      const finalOpponent = opponent === '__custom__' ? customOpponent.trim() : opponent
      if (!finalOpponent) return
      const game = await createGame(selectedTeam.team_id, finalOpponent, gameDate)
      onGameReady({ team: selectedTeam, game, pitcher: selectedPitcher })
    } catch (e) { setError(e.message) }
  }

  async function handleResumeGame(game) {
    const savedState = game.game_state
      ? game.game_state
      : await loadGameState(game.game_id).catch(() => null)
    onGameReady({ team: selectedTeam, game, pitcher: selectedPitcher, savedState })
  }

  async function handleDeleteGame(e, gameId) {
    e.stopPropagation()
    if (!confirm('Delete this game and all its pitch data?')) return
    try {
      await deleteGame(gameId)
      setGames(gs => gs.filter(g => g.game_id !== gameId))
    } catch(err) { alert('Delete failed: ' + err.message) }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-dim)', fontFamily:"'Share Tech Mono', monospace", letterSpacing:3 }}>
      INITIALIZING SYSTEM...
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minHeight:'100vh', gap:24, padding:40, overflowY:'auto' }}>
      <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:32, fontWeight:700, color:'var(--gold)', letterSpacing:4 }}>
        PITCH INTELLIGENCE
      </div>
      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--text-dim)', letterSpacing:4 }}>
        COMMAND CENTER
      </div>
      {authUser && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:'var(--text-dim)' }}>{authUser.email}</div>
          <button onClick={onSignOut} style={{ padding:'4px 14px', background:'transparent', border:'1px solid rgba(61,96,128,0.4)', borderRadius:4, color:'#3D6080', fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1, cursor:'pointer' }}>SIGN OUT</button>
        </div>
      )}

      {error && <div style={{ color:'var(--red)', fontSize:12, fontFamily:"'Share Tech Mono', monospace" }}>{error}</div>}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, padding:28, width:420, display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, letterSpacing:3, color:'var(--text-dim)' }}>SELECT TEAM</div>
        <select onChange={e => setSelectedTeam(teams.find(t => t.team_id === Number(e.target.value)) || null)}>
          <option value="">— choose team —</option>
          {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
        </select>

        {selectedTeam && (
          <>
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, letterSpacing:3, color:'var(--text-dim)' }}>NEW GAME</div>
                <button
                  onClick={() => setShowPreGamePrep(true)}
                  style={{
                    padding:'5px 12px', borderRadius:4, cursor:'pointer',
                    background:'rgba(0,212,255,0.08)',
                    border:'1px solid rgba(0,212,255,0.3)',
                    color:'var(--cyan)',
                    fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1,
                  }}
                >🎯 PRE-GAME PREP</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <select
                  value={customOpponent ? '__custom__' : opponent}
                  onChange={e => {
                    if (e.target.value === '__custom__') {
                      setOpponent('__custom__')
                      setCustomOpponent('')
                    } else {
                      setOpponent(e.target.value)
                      setCustomOpponent('')
                    }
                  }}
                  style={{ background:'var(--panel)', border:'1px solid var(--border)', color: opponent ? 'var(--text-primary)' : 'var(--text-dim)', borderRadius:4, padding:'8px 10px', fontSize:14, fontFamily:"'DM Sans', sans-serif", cursor:'pointer' }}
                >
                  <option value="">— Select opponent —</option>
                  {savedOpponents.length > 0 && (
                    <optgroup label="── SAVED OPPONENTS ──">
                      {savedOpponents.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </optgroup>
                  )}
                  {teams.filter(t => t.team_id !== selectedTeam?.team_id).length > 0 && (
                    <optgroup label="── YOUR TEAMS ──">
                      {teams
                        .filter(t => t.team_id !== selectedTeam?.team_id)
                        .map(t => <option key={t.team_id} value={t.name}>{t.name}</option>)
                      }
                    </optgroup>
                  )}
                  <option value="__custom__">+ New opponent (type name)</option>
                </select>
                {opponent === '__custom__' && (
                  <input
                    placeholder="Enter opponent team name"
                    value={customOpponent}
                    onChange={e => setCustomOpponent(e.target.value)}
                    onBlur={e => { if (e.target.value.trim()) setOpponent(e.target.value.trim()) }}
                    autoFocus
                    style={{ background:'var(--panel)', border:'1px solid var(--gold)', color:'var(--text-primary)', borderRadius:4, padding:'8px 10px', fontSize:14, fontFamily:"'DM Sans', sans-serif", outline:'none' }}
                  />
                )}
                <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} />
                {opponent && opponent !== '__custom__' && (
                  <button
                    onClick={() => setShowOpponentScouting(true)}
                    style={{
                      padding:'10px 14px', borderRadius:6, cursor:'pointer',
                      background:'rgba(245,166,35,0.08)',
                      border:'1px solid rgba(245,166,35,0.35)',
                      color:'var(--gold)', fontFamily:"'Share Tech Mono',sans-serif",
                      fontSize:10, letterSpacing:1, display:'flex', alignItems:'center', gap:8,
                      textAlign:'left',
                    }}
                  >
                    <span>🛩️</span>
                    <div>
                      <div>F-16 SCOUTING INTEL</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>View opponent scouting report</div>
                    </div>
                  </button>
                )}

                {/* Pitcher selector */}
                {pitchers.length > 0 && (
                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, letterSpacing:3, color:'var(--text-dim)' }}>STARTING PITCHER</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {pitchers.map(p => {
                        const isSelected = selectedPitcher?.player_id === p.player_id
                        return (
                          <div key={p.player_id} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          <div
                            onClick={() => setSelectedPitcher(p)}
                            style={{
                              padding:'10px 12px',
                              border:`1px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                              borderRadius:6,
                              cursor:'pointer',
                              background: isSelected ? 'rgba(245,166,35,0.08)' : 'rgba(255,255,255,0.02)',
                              transition:'all 0.15s',
                            }}
                          >
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                {isSelected && <span style={{ color:'var(--gold)', fontSize:10 }}>●</span>}
                                <span style={{ fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:15, color: isSelected ? 'var(--gold)' : 'var(--text-primary)' }}>
                                  #{p.jersey} {p.name}
                                </span>
                              </div>
                              <div style={{ display:'flex', gap:6 }}>
                                {p.throws && (
                                  <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--text-secondary)', background:'rgba(255,255,255,0.05)', padding:'2px 7px', borderRadius:10 }}>
                                    {p.throws === 'R' ? 'RHP' : 'LHP'}
                                  </span>
                                )}
                                {p.pitching_style && (
                                  <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--cyan)', background:'rgba(0,212,255,0.08)', padding:'2px 7px', borderRadius:10 }}>
                                    {p.pitching_style.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Arsenal pills */}
                            {(p.pitcher_arsenal || []).length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                                {p.pitcher_arsenal.map(pitch => (
                                  <span key={pitch} style={{
                                    fontFamily:"'Share Tech Mono', monospace",
                                    fontSize:8,
                                    color:'var(--cyan)',
                                    background:'rgba(0,212,255,0.08)',
                                    border:'1px solid rgba(0,212,255,0.2)',
                                    padding:'2px 7px',
                                    borderRadius:10,
                                    letterSpacing:1
                                  }}>{pitch}</span>
                                ))}
                              </div>
                            )}
                            {/* Speed ranges */}
                            {p.pitch_speeds && Object.keys(p.pitch_speeds).length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:5 }}>
                                {Object.entries(p.pitch_speeds).map(([pitch, speed]) => (
                                  <span key={pitch} style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:8, color:'var(--text-dim)' }}>
                                    {pitch}: <span style={{ color:'var(--amber)' }}>{speed} mph</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {p.pitcher_notes && (
                              <div style={{ marginTop:5, fontFamily:"'DM Sans', sans-serif", fontSize:11, color:'var(--text-secondary)', fontStyle:'italic' }}>
                                {p.pitcher_notes}
                              </div>
                            )}
                          </div>
                          {/* Scouting button lives OUTSIDE the clickable card div */}
                          <button
                            onClick={() => { setSelectedPitcher(p); setShowScoutingReport(true) }}
                            style={{ padding:'6px 12px', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.35)', borderRadius:4, color:'#00D4FF', fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:1, cursor:'pointer', width:'100%' }}
                          >
                            📊 VIEW SCOUTING REPORT
                          </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {pitchers.length === 0 && selectedTeam && (
                  <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:'var(--text-dim)', padding:'8px 0' }}>
                    No pitchers found — add pitchers in the Roster tab after starting the game.
                  </div>
                )}

                <button
                  onClick={handleCreateGame}
                  disabled={!opponent || opponent === '__custom__'}
                  style={{ background:'var(--gold)', border:'none', color:'var(--void)', fontFamily:"'Rajdhani', sans-serif", fontWeight:700, fontSize:15, letterSpacing:2, padding:'12px 0', borderRadius:4, cursor:'pointer', opacity: (!opponent || opponent === '__custom__') ? 0.5 : 1, marginTop:4 }}
                >
                  START NEW GAME
                </button>
              </div>
            </div>

            {games.length > 0 && (() => {
              const SHOW = 3
              const visible = showAllGames ? games : games.slice(0, SHOW)
              const hasMore = games.length > SHOW
              return (
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
                  <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, letterSpacing:3, color:'var(--text-dim)', marginBottom:10 }}>
                    RESUME GAME <span style={{ color:'var(--amber)' }}>({games.length})</span>
                  </div>
                  {visible.map(g => (
                    <ResumeGameRow
                      key={g.game_id}
                      game={g}
                      onResume={handleResumeGame}
                      onDelete={handleDeleteGame}
                    />
                  ))}
                  {hasMore && (
                    <button
                      onClick={() => setShowAllGames(v => !v)}
                      style={{
                        width:'100%', padding:'7px 0', marginTop:2,
                        background:'transparent', border:'1px solid var(--border)',
                        color:'var(--text-dim)', borderRadius:4, cursor:'pointer',
                        fontFamily:"'Share Tech Mono', monospace", fontSize:9, letterSpacing:2,
                        transition:'all 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      {showAllGames ? '▲ SHOW LESS' : `▼ SHOW ${games.length - SHOW} MORE`}
                    </button>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </div>
      {showPreGamePrep && selectedTeam && (
        <PreGamePrep
          teamId={selectedTeam.team_id}
          onClose={() => { setShowPreGamePrep(false); getSavedOpponentTeams(selectedTeam.team_id).then(setSavedOpponents) }}
        />
      )}
      {showOpponentScouting && opponent && selectedTeam && (
        <OpponentScouting
          teamId={selectedTeam.team_id}
          opponentName={opponent}
          onClose={() => setShowOpponentScouting(false)}
        />
      )}
      {showScoutingReport && selectedPitcher && selectedTeam && (
        <PitcherScoutingReport
          teamId={selectedTeam.team_id}
          pitcherName={selectedPitcher.name}
          opponentFilter={opponent}
          onClose={() => setShowScoutingReport(false)}
        />
      )}
    </div>
  )
}

// ─── Half Inning Modal ────────────────────────────────────────────────────────
function HalfInningModal({ modal, topBottom, ourLineup, onChoice }) {
  if (!modal) return null
  // Use wasTop captured at modal-open time, not live topBottom state
  // (live state may have already updated by render time, causing wrong branch)
  const isTop = modal.wasTop !== undefined ? modal.wasTop : topBottom === 'top'
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(5,12,20,0.88)',
      backdropFilter:'blur(4px)', zIndex:300,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        background:'#0C1C2E', border:'1px solid #1A3550',
        borderRadius:12, padding:32, width:'min(420px, 90vw)', textAlign:'center',
      }}>
        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, letterSpacing:3, color:'#7BACC8', marginBottom:8 }}>
          {isTop ? `END OF TOP ${modal.inning}` : `END OF INNING ${modal.inning}`}
        </div>
        <div style={{ fontFamily:"'Bebas Neue','Rajdhani',sans-serif", fontSize:40, color:'#F5A623', letterSpacing:4, marginBottom:8 }}>
          3 OUTS
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'#7BACC8', marginBottom:28, lineHeight:1.5 }}>
          {isTop
            ? `Inning ${modal.inning} top half complete. What's next?`
            : `Inning ${modal.inning} complete. Advancing to inning ${modal.nextInning}.`}
        </div>
        {isTop ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={() => onChoice('bottom')} style={{
              background:'rgba(0,212,255,0.12)', border:'1px solid rgba(0,212,255,0.35)',
              color:'#00D4FF', borderRadius:8, padding:'14px 0', cursor:'pointer',
              fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:16, letterSpacing:2,
            }}>
              ⬇ CHART BOTTOM {modal.inning}
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'#7BACC8', marginTop:2, fontWeight:400, letterSpacing:1 }}>
                {ourLineup.length > 0 ? `Loads Lady Hawks lineup (${ourLineup.length} players)` : 'Add your roster in the Roster tab first'}
              </div>
            </button>
            <button onClick={() => onChoice('skip')} style={{
              background:'rgba(245,166,35,0.12)', border:'1px solid rgba(245,166,35,0.35)',
              color:'#F5A623', borderRadius:8, padding:'14px 0', cursor:'pointer',
              fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:16, letterSpacing:2,
            }}>
              → TOP OF INNING {modal.inning + 1}
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'#7BACC8', marginTop:2, fontWeight:400, letterSpacing:1 }}>
                Skip to next opponent at-bat (default)
              </div>
            </button>
          </div>
        ) : (
          <button onClick={() => onChoice('next')} style={{
            background:'rgba(245,166,35,0.12)', border:'1px solid rgba(245,166,35,0.35)',
            color:'#F5A623', borderRadius:8, padding:'14px 0', width:'100%', cursor:'pointer',
            fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:16, letterSpacing:2,
          }}>
            → TOP OF INNING {modal.nextInning}
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'#7BACC8', marginTop:2, fontWeight:400, letterSpacing:1 }}>
              Continue charting opponent
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const toast = useToast()
  const [authUser, setAuthUser]           = useState(undefined) // undefined=loading, null=logged out, object=logged in
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)
  const [session, setSession] = useState(null) // { team, game, savedState? }

  // B-002: Wrap setSession to persist/clear active game_id in sessionStorage
  function startSession(sessionData) {
    if (sessionData?.game?.game_id) {
      try { sessionStorage.setItem('pi_active_game_id', String(sessionData.game.game_id)) } catch(e) {}
    }
    setSession(sessionData)
  }
  function endSession() {
    try { sessionStorage.removeItem('pi_active_game_id') } catch(e) {}
    setSession(null)
  }
  const [showRoster, setShowRoster] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [hitterNotes, setHitterNotes] = useState({}) // { batterName: { text, tags } }
  const [showGameSummary, setShowGameSummary] = useState(false)
  const [aiRecs, setAiRecs]         = useState(null)   // Claude API results
  const [aiLoading, setAiLoading]   = useState(false)  // Claude in-flight
  const [aiSource, setAiSource]     = useState('rule') // 'rule' | 'claude'
  const [aiTrigger, setAiTrigger]   = useState(null)   // current trigger type
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(null) // null | { reason }
  const [activeView, setActiveView] = useState('chart')  // 'chart' | 'scorebook'
  const [showScorebook, setShowScorebook] = useState(false)
  const [showHalfInningModal, setShowHalfInningModal] = useState(null)
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 1280

  // ── Game state ───────────────────────────────────────────────────────────────
  const [balls, setBalls]     = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [outs, setOuts]       = useState(0)
  const [inning, setInning]   = useState(1)
  const [topBottom, setTopBottom] = useState('top')
  const [ourRuns, setOurRuns] = useState(0)
  const [oppRuns, setOppRuns] = useState(0)
  const [on1b, setOn1b]       = useState(false)
  const [on2b, setOn2b]       = useState(false)
  const [on3b, setOn3b]       = useState(false)

  // ── Roster state ─────────────────────────────────────────────────────────────
  const [lineup, setLineup]         = useState([])   // active BATTING lineup (starters only)
  const lineupRef = useRef([])                         // always-current ref for use in async handlers
  const lastLineupPosRef = useRef(0)                   // tracks last batter position across inning boundaries
  const [subs, setSubs]             = useState([])   // bench / substitutes not yet in lineup
  const [ourLineup, setOurLineup]   = useState([])   // full Lady Hawks roster (starters + subs)
  const [oppLineup, setOppLineup]   = useState([])   // full opponent roster (starters + subs)
  const [lineupPos, setLineupPos]   = useState(0)
  // Keep ref in sync with state — must be AFTER lineupPos declaration
  lastLineupPosRef.current = lineupPos
  const [manualBatterName, setManualBatterName] = useState('')
  // LINEUP MODE: 'standard'=9, 'dp_flex'=10 (9 bat), 'eh'=10 (10 bat), 'dp_flex_eh'=11 (10 bat), 'free_sub'=full roster
  const [lineupMode, setLineupMode] = useState('standard')
  const [pitchers, setPitchers]     = useState([])
  const [arsenal, setArsenal]       = useState(DEFAULT_ARSENAL)
  const [pitcherName, setPitcherName] = useState('')

  // ── Charting state ───────────────────────────────────────────────────────────
  const [activePA, setActivePA]         = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)
  const [selectedPitch, setSelectedPitch] = useState(null)
  const [selectedOutcome, setSelectedOutcome] = useState(null)
  const [inPlayDetail, setInPlayDetail] = useState({ outcome_inplay: '', fielder: '', location: '', runs_scored: 0, rbi: 0, foul_location: '' })  // B-014: foul_location added

  // ── Pitch data ────────────────────────────────────────────────────────────────
  const [gamePitches, setGamePitches]   = useState([])
  const [paPitches, setPAPitches]       = useState([])  // pitches this PA
  // B-008/B-003: PA-level undo stack — stores full game state snapshots before each PA closes
  const [paUndoStack, setPaUndoStack]   = useState([])  // [{lineupPos,outs,on1b,on2b,on3b,ourRuns,oppRuns,pa,pitches}]
  const [allPAs, setAllPAs]             = useState([])

  // ── Split a roster into starters (batting lineup) and subs ─────────────────────
  function splitLineup(players, mode) {
    const BATTING_COUNTS = { standard: 9, dp_flex: 9, eh: 10, dp_flex_eh: 10, free_sub: Infinity }
    const batCount = BATTING_COUNTS[mode] ?? 9

    // Sort everyone by lineup_order (nulls/0 go last)
    const sorted = [...players].sort((a, b) => {
      const ao = a.lineup_order || 999
      const bo = b.lineup_order || 999
      return ao - bo
    })

    // Take first batCount as starters — tolerates sparse/wrong lineup_order values.
    // If fewer players than batCount exist, all of them are starters (no bench).
    const starters = sorted.slice(0, batCount === Infinity ? sorted.length : batCount)
    const bench    = sorted.slice(batCount === Infinity ? sorted.length : batCount)
    return { starters, bench }
  }

  // ── Auth state listener ──────────────────────────────────────────────────────
  useEffect(() => {
    // Check URL hash for recovery token on fresh page load (mobile magic link tap)
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      setNeedsPasswordReset(true)
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      // Don't overwrite needsPasswordReset=true if we detected it from URL hash
      setAuthUser(user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked reset link — show password reset screen
        setNeedsPasswordReset(true)
        setAuthUser(authSession?.user ?? null)
      } else if (event === 'USER_UPDATED') {
        // Password was successfully updated — clear recovery state
        setNeedsPasswordReset(false)
        setAuthUser(authSession?.user ?? null)
      } else {
        setNeedsPasswordReset(false)
        setAuthUser(authSession?.user ?? null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load roster + pitches when session starts ─────────────────────────────────
  useEffect(() => {
    if (!session) return
    const { team, game, savedState } = session

    // Load everything — lineup MUST be set before PAs to avoid race condition
    // where PA history overwrites the proper roster lineup
    async function loadSession() {
      try {
        // ── Step 1: lineup (must come first) ──────────────────────────
        const [oppPlayers, ourPlayers, ps] = await Promise.all([
          getOpponentLineup(team.team_id, game.opponent),
          getPlayers(team.team_id),
          getPitchers(team.team_id),
        ])

  

        const mode = savedState?.lineup_mode ?? lineupMode
        const { starters, bench } = splitLineup(oppPlayers, mode)

        setOppLineup(oppPlayers)
        setOurLineup(ourPlayers)
        setLineup(starters)
        setSubs(bench)
        setLineupPos(0)

        // Pitchers
        setPitchers(ps)
        const chosen = session?.pitcher || ps[0] || null
        if (chosen) {
          setPitcherName(chosen.name)
          setArsenal(chosen.pitcher_arsenal?.length ? chosen.pitcher_arsenal : DEFAULT_ARSENAL)
        } else {
          setPitcherName('Pitcher')
          setArsenal(DEFAULT_ARSENAL)
        }

        // ── Step 2: restore saved state (after lineup is set) ─────────
        if (savedState) {
          setInning(savedState.inning ?? 1)
          setTopBottom(savedState.top_bottom ?? 'top')
          setOuts(savedState.outs ?? 0)
          setOurRuns(savedState.our_runs ?? 0)
          setOppRuns(savedState.opp_runs ?? 0)
          setOn1b(savedState.on1b ?? false)
          setOn2b(savedState.on2b ?? false)
          setOn3b(savedState.on3b ?? false)
          const restoredPos = savedState.lineup_pos ?? 0
          setLineupPos(restoredPos)  // lastLineupPosRef auto-syncs
          setLineupMode(savedState.lineup_mode ?? 'standard')
          if (savedState.pitcher_name) setPitcherName(savedState.pitcher_name)
          if (savedState.balls    != null) setBalls(savedState.balls)
          if (savedState.strikes  != null) setStrikes(savedState.strikes)
        }

        // ── Step 3: pitch history + hitter notes ──────────────────────
        const [pitches, pas, notes] = await Promise.all([
          getPitchesForGame(game.game_id),
          getPAsForGame(game.game_id),
          getHitterNotes(team.team_id, game.opponent),
        ])
        setGamePitches(pitches)
        setAllPAs(pas)
        // Convert notes array to map keyed by batter_name
        const notesMap = {}
        notes.forEach(n => { notesMap[n.batter_name] = { text: n.note_text, tags: n.tags || [] } })
        setHitterNotes(notesMap)

      } catch(e) { toast.error(`Failed to load game data: ${e.message}`) }
    }

    loadSession()
  }, [session])

  // ── Auto-save game state after every significant change (debounced 1.5s) ──────
  useEffect(() => {
    if (!session?.game?.game_id) return
    setSaveStatus('saving')
    const timer = setTimeout(async () => {  // B-002: reduced from 1500ms
      try {
        await saveGameState(session.game.game_id, {
          inning, topBottom, outs,
          ourRuns, oppRuns,
          on1b, on2b, on3b,
          lineupPos, pitcherName, lineupMode,
          balls, strikes,
          activePaId: activePA?.pa_id || null,
        })
        setSaveStatus('saved')
        // Reset to idle after 2s
        setTimeout(() => setSaveStatus('idle'), 2000)  // B-002
      } catch (e) {
        toast.warn('Auto-save failed — check connection', { duration: 6000 })
        setSaveStatus('error')
      }
    }, 300)
    return () => clearTimeout(timer)  // B-002: was 1500ms
  }, [inning, topBottom, outs, ourRuns, oppRuns, on1b, on2b, on3b, lineupPos, pitcherName, lineupMode, activePA])

  // B-002: On auth, check sessionStorage for interrupted game and auto-resume
  useEffect(() => {
    if (!authUser) return
    const savedId = (() => { try { return sessionStorage.getItem('pi_active_game_id') } catch(e) { return null } })()
    if (!savedId || session) return
    async function tryResume() {
      try {
        const teams = await getTeams()
        for (const team of teams) {
          const games = await getGames(team.team_id)
          const game = games.find(g => String(g.game_id) === savedId)
          if (game) {
            const savedState = await loadGameState(game.game_id).catch(() => null)
            startSession({ team, game, savedState })
            toast.success('Game resumed after refresh')
            return
          }
        }
        try { sessionStorage.removeItem('pi_active_game_id') } catch(e) {}
      } catch(e) { console.warn('Auto-resume failed:', e.message) }
    }
    tryResume()
  }, [authUser])

  // B-002: Save game state immediately on page unload (refresh/close)
  useEffect(() => {
    if (!session?.game?.game_id) return
    function handleBeforeUnload() {
      // Use sendBeacon for reliable fire-and-forget on page unload
      const state = {
        inning, top_bottom: topBottom, outs,
        our_runs: ourRuns, opp_runs: oppRuns,
        on1b, on2b, on3b,
        lineup_pos: lineupPos, pitcher_name: pitcherName, lineup_mode: lineupMode,
        saved_at: new Date().toISOString(),
      }
      // Best-effort saveGameState via fetch (may not complete but usually does)
      saveGameState(session.game.game_id, {
        inning, topBottom, outs, ourRuns, oppRuns,
        on1b, on2b, on3b, lineupPos, pitcherName, lineupMode,
        balls, strikes,
        activePaId: activePA?.pa_id || null,
      }).catch(() => {})
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session, inning, topBottom, outs, ourRuns, oppRuns, on1b, on2b, on3b, lineupPos, pitcherName, lineupMode, activePA])

  // Keep refs current so async handlers don't capture stale closures
  lineupRef.current = lineup

  // ── Current batter ────────────────────────────────────────────────────────────
  const currentBatter = lineup[lineupPos] || (manualBatterName ? { name: manualBatterName, jersey: '?', batter_type: 'unknown', lineup_order: 0 } : null)

  // ── Analytics (derived) ───────────────────────────────────────────────────────
  const stats        = computePitchStats(gamePitches)
  const breakdown    = pitchTypeBreakdown(gamePitches)
  const effectiveness = pitchEffectiveness(gamePitches)
  const pci       = computePCI(gamePitches)
  const lm        = computeLeverage(inning, outs, on1b, on2b, on3b, ourRuns, oppRuns)
  const prr       = computePRR(paPitches, gamePitches.filter(p => p.batter_name === (currentBatter?.name || '')))
  const reverseSwitch = checkReverseSwitch(balls, strikes, pci, currentBatter?.batter_tendency || 'unknown', arsenal, on3b, lm)

  // Rule-based (instant, always available)
  const ruleSignals = generateSignals(paPitches, balls, strikes, currentBatter?.batter_type, {
    gamePitches,
    batterName:          currentBatter?.name,
    batterPlayer:        currentBatter,
    pitcher:             pitchers.find(p => p.name === pitcherName) || null,
    inning, outs, on1b, on2b, on3b, ourRuns, oppRuns,
    allHistoricalPitches: [],
  })
  const ruleRecs = generateRecommendations(
    paPitches, balls, strikes, currentBatter?.batter_type || 'unknown', arsenal,
    { pci, lm, prr, gamePitches, batterName: currentBatter?.name }
  )
  // Use Claude results if available, fallback to rule-based
  const signals         = aiRecs?.signals        || ruleSignals
  const recommendations = aiRecs?.recommendations || ruleRecs

  // ── Layer 4: Post-AB summary — fires when a PA completes ─────────────────────
  const prevPACountRef = useRef(0)
  useEffect(() => {
    const count = allPAs.length
    if (count <= prevPACountRef.current) { prevPACountRef.current = count; return }
    prevPACountRef.current = count
    if (!session || paPitches.length === 0) return
    // Fire post-AB summary async — don't block anything
    const lastBatterName = allPAs[allPAs.length-1]?.batter_name
    const lastBatter = oppLineup.find(p => p.name === lastBatterName) || { name: lastBatterName }
    generatePostABSummary({
      teamId:    session.team.team_id,
      opponent:  session.game.opponent,
      batter:    lastBatter,
      paPitches: gamePitches.filter(p => p.pa_id === allPAs[allPAs.length-1]?.pa_id),
      allGamePAs: allPAs,
      pitcherName,
      arsenal,
    }).catch(() => {}) // silent failure
  }, [allPAs.length])

  // ── Claude AI enrichment ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentBatter || !pitcherName || !arsenal.length) return
    // Clear stale AI results when batter changes
    setAiRecs(null)
    setAiSource('rule')
  }, [currentBatter?.name])

  useEffect(() => {
    if (!currentBatter || !pitcherName || !arsenal.length) return
    if (aiLoading) return

    // Trigger Claude on meaningful events: new pitch, new PA, new batter
    const triggerAI = async () => {
      setAiLoading(true)
      const hitterNote = hitterNotes[currentBatter?.name] || null
      const aiMemory   = hitterNote?.ai_summary || null
      const result = await getClaudeRecommendations({
        batter:      currentBatter,
        batterType:  currentBatter?.batter_type || 'unknown',
        balls, strikes, outs, inning, topBottom,
        ourRuns, oppRuns, on1b, on2b, on3b,
        paPitches, gamePitches, arsenal, pitcherName,
        pci, hitterNote, aiMemory,
        teamId:   session?.team?.team_id,
        opponent: session?.game?.opponent,
      })
      if (result) {
        setAiRecs(result)
        setAiSource('claude')
        setAiTrigger(result.trigger || null)
      }
      setAiLoading(false)
    }

    triggerAI()
  }, [paPitches.length, balls, strikes, currentBatter?.name, inning])

  // Batter stats today — full line: AB, H, K, BB
  const batterStats = currentBatter ? (() => {
    const batterPAs   = allPAs.filter(p => p.batter_name === currentBatter.name)
    const HIT_SET     = new Set(['Single','Double','Triple','Home Run'])
    const OUT_SET     = new Set(['CK','SK','IP'])  // AB outcomes (not walk/HBP)
    const hits        = gamePitches.filter(p =>
      p.batter_name === currentBatter.name &&
      p.outcome_basic === 'IP' &&
      HIT_SET.has(p.outcome_inplay)
    ).length
    const strikeouts  = batterPAs.filter(p => ['CK','SK'].includes(p.pa_result)).length
    const walks       = batterPAs.filter(p => p.pa_result === 'B').length
    // AB = PAs minus walks, HBP
    const abs         = batterPAs.filter(p => !['B','HBP'].includes(p.pa_result)).length
    return { paToday: batterPAs.length, abs, hits, strikeouts, walks }
  })() : null

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleScoreChange(side, delta) {
    if (side === 'our') setOurRuns(r => Math.max(0, r + delta))
    else setOppRuns(r => Math.max(0, r + delta))
  }

  function handleToggleBase(base) {
    if (base === '1b') setOn1b(v => !v)
    else if (base === '2b') setOn2b(v => !v)
    else if (base === '3b') setOn3b(v => !v)
    // B-005: Stolen base / manual runner advance
    else if (base === 'steal_2b') {
      // 1B steals 2B
      setOn1b(false)
      setOn2b(true)
    } else if (base === 'steal_3b') {
      // 2B steals 3B
      setOn2b(false)
      setOn3b(true)
    } else if (base === 'steal_home') {
      // 3B steals home — scores a run
      setOn3b(false)
      if (topBottom === 'top') {
        setOppRuns(r => r + 1)
      } else {
        setOurRuns(r => r + 1)
      }
    } else if (base === 'clear_bases') {
      setOn1b(false); setOn2b(false); setOn3b(false)
    // B-020: Caught stealing — remove runner, add an out
    } else if (base === 'cs_1b') {
      setOn1b(false)
      setOuts(prev => {
        const next = prev + 1
        if (next >= 3) {
          setShowHalfInningModal({ inning, nextHalf: topBottom === 'top' ? 'bottom' : 'top', nextInning: topBottom === 'bottom' ? inning + 1 : inning, wasTop: topBottom === 'top' })
          setOn1b(false); setOn2b(false); setOn3b(false)
          return 0
        }
        return next
      })
    } else if (base === 'cs_2b') {
      setOn2b(false)
      setOuts(prev => {
        const next = prev + 1
        if (next >= 3) {
          setShowHalfInningModal({ inning, nextHalf: topBottom === 'top' ? 'bottom' : 'top', nextInning: topBottom === 'bottom' ? inning + 1 : inning, wasTop: topBottom === 'top' })
          setOn1b(false); setOn2b(false); setOn3b(false)
          return 0
        }
        return next
      })
    } else if (base === 'cs_3b') {
      setOn3b(false)
      setOuts(prev => {
        const next = prev + 1
        if (next >= 3) {
          setShowHalfInningModal({ inning, nextHalf: topBottom === 'top' ? 'bottom' : 'top', nextInning: topBottom === 'bottom' ? inning + 1 : inning, wasTop: topBottom === 'top' })
          setOn1b(false); setOn2b(false); setOn3b(false)
          return 0
        }
        return next
      })
    }
  }

  function handleSelectBatter(idx) {
    setLineupPos(idx)
  }

  function handleApplyRec(rec) {
    // Clicking a recommendation pre-selects pitch and zone
    const pitchName = arsenal.find(a => a.toUpperCase() === rec.pitch)
    if (pitchName) setSelectedPitch(pitchName)
    if (rec.zone) {
      const [row, col] = rec.zone.split('-').map(Number)
      setSelectedZone({ row, col })
    }
  }

  function handleHalfInning(choice) {
    const m = showHalfInningModal
    if (!m) return

    if (choice === 'skip') {
      // Skip bottom — opponent bats top of next inning, order continues
      const nextInn = m.nextInning || m.inning + 1
      setInning(nextInn)
      setTopBottom('top')
      checkEndGameConditions(nextInn, ourRuns, oppRuns)
      const { starters: skipStarters, bench: skipBench } = splitLineup(oppLineup, lineupMode)
      setLineup(skipStarters)
      setSubs(skipBench)
      // Restore the last known position — batting order is continuous across innings
      setLineupPos(lastLineupPosRef.current)
    } else if (choice === 'bottom') {
      // Chart bottom half — OUR team bats
      setTopBottom('bottom')
      if (ourLineup.length > 0) {
        const { starters, bench } = splitLineup(ourLineup, lineupMode)
        setLineup(starters)
        setSubs(bench)
      } else {
        setLineup([])
        setSubs([])
      }
      setLineupPos(0)  // Lady Hawks start fresh each time for now
    } else if (choice === 'next') {
      // End of bottom — opponent bats top of next inning, order continues
      const nextInn2 = m.nextInning || m.inning + 1
      setInning(nextInn2)
      setTopBottom('top')
      checkEndGameConditions(nextInn2, ourRuns, oppRuns)
      const { starters, bench } = splitLineup(oppLineup, lineupMode)
      setLineup(starters)
      setSubs(bench)
      // Restore the last known position — batting order is continuous across innings
      setLineupPos(lastLineupPosRef.current)
    }
    setManualBatterName('')
    setActivePA(null)
    setPAPitches([])
    setBalls(0)
    setStrikes(0)
    setShowHalfInningModal(null)
  }

  function handlePitcherChange(playerId) {
    const p = pitchers.find(x => x.player_id === Number(playerId))
    if (!p) return
    setPitcherName(p.name)
    setArsenal(p.pitcher_arsenal?.length ? p.pitcher_arsenal : DEFAULT_ARSENAL)
    // End current PA on pitcher change
    setActivePA(null)
    setPAPitches([])
    setBalls(0)
    setStrikes(0)
  }

  async function handleNewPA() {
    if (!session || !currentBatter) return
    try {
      const pa = await createPA(
        session.game.game_id,
        inning,
        outs,
        currentBatter.name,
        pitcherName,
        lineupPos + 1,
      )
      setActivePA(pa)
      setPAPitches([])
      setBalls(0)
      setStrikes(0)
      setSelectedZone(null)
      setSelectedPitch(null)
      setSelectedOutcome(null)
    } catch (e) { console.error(e) }
  }

  async function handleRecord() {
    if (!selectedZone || !selectedPitch || !selectedOutcome) return
    if (!session) return

    const isPA = activePA != null

    // Auto-create PA if none active
    let pa = activePA
    if (!pa) {
      try {
        const batterName = currentBatter?.name || 'Unknown'
        const lineupSpot = currentBatter ? lineupPos + 1 : 0
        pa = await createPA(
          session.game.game_id, inning, outs,
          batterName, pitcherName, lineupSpot
        )
        setActivePA(pa)
      } catch (e) { toast.error(`Failed to start plate appearance: ${e.message}`); return }
    }

    const pitch = {
      game_id:        session.game.game_id,
      pa_id:          pa?.pa_id,
      pitcher_name:   pitcherName,
      batter_name:    currentBatter?.name || '',
      pitch_type:     selectedPitch,
      zone_row:       selectedZone.row,
      zone_col:       selectedZone.col,
      outcome_basic:  selectedOutcome,
      outcome_inplay: selectedOutcome === 'IP' ? inPlayDetail.outcome_inplay : null,
      result_detail:  selectedOutcome === 'IP' ? [inPlayDetail.fielder, inPlayDetail.location].filter(Boolean).join(' - ') || null : null,
      runs_scored:    selectedOutcome === 'IP' ? inPlayDetail.runs_scored : 0,
      rbi:            selectedOutcome === 'IP' ? inPlayDetail.rbi : 0,
      outs,
      balls_before:   balls,
      strikes_before: strikes,
      inning,
    }

    try {
      const saved = await insertPitch(pitch)
      const newPAPitches = [...paPitches, { ...pitch, pitch_id: saved.pitch_id }]
      const newGamePitches = [...gamePitches, { ...pitch, pitch_id: saved.pitch_id }]
      setPAPitches(newPAPitches)
      setGamePitches(newGamePitches)

      // Advance count
      const next = advanceCount(balls, strikes, selectedOutcome)
      setBalls(next.balls)
      setStrikes(next.strikes)

      // Determine if PA is over
      const isStrikeout = ['CK', 'SK'].includes(selectedOutcome) && next.strikes >= 3
      const isWalk      = selectedOutcome === 'B'   && next.balls >= 4
      const isHBP       = selectedOutcome === 'HBP'
      const isInPlay    = selectedOutcome === 'IP'
      // B-014: Bunt foul on 2 strikes = strikeout (NFHS/USSSA rule)
      const isBuntFoulK = selectedOutcome === 'F' && inPlayDetail.foul_location === 'Bunt Foul' && strikes === 2
      const paOver      = isStrikeout || isWalk || isHBP || isInPlay || isBuntFoulK

      // Batter is out on: strikeout, or in-play out (groundout/flyout/etc)
      // B-004: Error and Fielder Choice reach base — NOT outs
      const HIT_RESULTS   = new Set(['Single','Double','Triple','Home Run','Sac Fly'])
      const REACH_RESULTS = new Set(['Error','Fielder Choice'])  // batter reaches but not a hit
      const OUT_RESULTS   = new Set(['Groundout','Flyout','Lineout','Popout','Sac Fly'])
      const DP_RESULTS    = new Set(['Double Play','DP (FC)'])   // B-009: double play = 2 outs
      const batterOut   = isStrikeout || isBuntFoulK
                       || (isInPlay && OUT_RESULTS.has(inPlayDetail.outcome_inplay))
                       || (isInPlay && DP_RESULTS.has(inPlayDetail.outcome_inplay))

      if (paOver) {
        // Update PA result
        if (pa) {
          await updatePAResult(pa.pa_id, selectedOutcome)
          setAllPAs(prev => [...prev, { ...pa, pa_result: selectedOutcome }])
        }

        // ── Baserunner advancement ──────────────────────────────────────
        // B-016: addRuns() always credits the BATTING team, not hard-coded opponent
        const addRuns = (n) => {
          if (n <= 0) return
          if (topBottom === 'top') setOppRuns(r => r + n)   // opponent bats top
          else                     setOurRuns(r => r + n)   // we bat bottom
        }

        const result = inPlayDetail.outcome_inplay
        if (isInPlay) {
          // Capture current base state before any mutations
          const was1b = on1b, was2b = on2b, was3b = on3b

          // Auto-calculate runs from standard NCAA advancement rules
          let autoRuns = 0

          if (result === 'Home Run') {
            // All runners + batter score (Rule 12.13.5)
            autoRuns = 1 + (was1b ? 1 : 0) + (was2b ? 1 : 0) + (was3b ? 1 : 0)
            setOn1b(false); setOn2b(false); setOn3b(false)

          } else if (result === 'Triple') {
            // All runners score, batter to 3B (Rule 12.13)
            autoRuns = (was1b ? 1 : 0) + (was2b ? 1 : 0) + (was3b ? 1 : 0)
            setOn1b(false); setOn2b(false); setOn3b(true)

          } else if (result === 'Double') {
            // 2B/3B score, 1B → 3B, batter to 2B (standard advancement)
            autoRuns = (was2b ? 1 : 0) + (was3b ? 1 : 0)
            setOn1b(false); setOn2b(true); setOn3b(was1b)

          } else if (result === 'Single') {
            // 3B scores, 2B→3B, 1B→2B, batter to 1B
            autoRuns = (was3b ? 1 : 0)
            setOn1b(true); setOn2b(was1b); setOn3b(was2b)

          } else if (result === 'Sac Fly') {
            // Runner on 3B scores (Rule 14.9.1), others hold
            if (was3b) { autoRuns = 1; setOn3b(false) }

          } else if (result === 'Fielder Choice' || result === 'DP (FC)' && false) {
            // B-018: Fielder's Choice — lead runner out, batter to 1B (Rule 14.1.11)
            // Defense chose to play on the lead runner instead of batter
            // Priority: retire the furthest-advanced runner
            if (was3b && was2b && was1b) {
              // Bases loaded FC — runner on 3B out, others advance (forced)
              setOn3b(false); setOn2b(true); setOn1b(true)  // batter forces everyone
            } else if (was3b && was2b) {
              setOn3b(false); setOn2b(true); setOn1b(true)
            } else if (was3b && was1b) {
              setOn3b(false); setOn1b(true)  // 3B out, 1B holds, batter to 1B... 
              // but 1B is occupied — push 1B runner to 2B
              setOn2b(true)
            } else if (was3b) {
              setOn3b(false); setOn1b(true)
            } else if (was2b && was1b) {
              setOn2b(false); setOn1b(true)  // 2B out, 1B holds, batter to 1B
              // 1B occupied — push to 2B
              setOn2b(true)
            } else if (was2b) {
              setOn2b(false); setOn1b(true)
            } else if (was1b) {
              setOn1b(true)  // 1B runner out, batter takes 1B
            } else {
              setOn1b(true)  // no runners, batter reaches
            }

          } else if (DP_RESULTS.has(result)) {
            // B-009/B-019: Double play — requires at least one runner
            // Batter out + lead runner out. Clear 1B (most common DP).
            if (was1b) setOn1b(false)
            else if (was2b) setOn2b(false)  // rare — no one on 1B

          } else if (result === 'Error') {
            // B-017: Error — batter reaches 1B
            // Do NOT auto-advance other runners beyond the forced move (Rule 14.20.1)
            // Exception: if 1B is occupied, that runner is forced to 2B (can't share base)
            if (was1b) {
              setOn2b(true)   // forced — runner on 1B must vacate for batter
            }
            setOn1b(true)
            // Any further advancement (2B→3B, 3B→home) is coach's call via GAME tab arrows

          } else if (result === 'Groundout' || result === 'Flyout' ||
                     result === 'Lineout'   || result === 'Popout') {
            // Standard outs — runners hold (no automatic advancement on outs)
            // Coach can manually advance any runners that tagged up, etc.
          }

          // Add auto-calculated runs to BATTING team (B-016)
          addRuns(autoRuns)

          // B-007: Coach manually entered more runs than auto-calc
          // (aggressive baserunning, runners scored that wouldn't by default)
          const manualRuns = inPlayDetail.runs_scored || 0
          if (manualRuns > autoRuns) {
            addRuns(manualRuns - autoRuns)
            // Clear ghost runners — if extra runners scored, they shouldn't sit on base
            if (result === 'Single' && was2b && !was3b && manualRuns >= 1) {
              setOn3b(false)  // 2B runner scored aggressively, not on 3B
            }
            if (result === 'Double' && was1b && manualRuns >= 2) {
              setOn3b(false)  // 1B runner scored all the way, not on 3B
            }
          } else if (autoRuns === 0 && manualRuns > 0) {
            // Non-hit result where coach manually tracked runs (e.g. Groundout, Error)
            addRuns(manualRuns)
          }

        } else if (isWalk || isHBP) {
          // Walk/HBP — force runners (Rule 12.13.1)
          const was1b = on1b, was2b = on2b, was3b = on3b
          if (was1b && was2b && was3b) { addRuns(1) }   // B-016: bases loaded walk scores
          setOn3b(was1b && was2b ? true : was3b)
          setOn2b(was1b ? true : was2b)
          setOn1b(true)
        } else if (isBuntFoulK) {
          // Bunt foul strikeout — no base changes
        }

        // ── Advance to next batter ────────────────────────────────────
        const currentLineup = lineupRef.current
        if (currentLineup.length > 0) {
          const nextPos = (lineupPos + 1) % currentLineup.length
          setLineupPos(nextPos)  // lastLineupPosRef auto-syncs via direct assignment above
        }

        // ── Update outs + handle inning change ─────────────────────────
        // B-009: Double Play adds 2 outs total
        const outsToAdd = DP_RESULTS.has(inPlayDetail.outcome_inplay) ? 2 : 1
        if (batterOut) {
          const newOuts = outs + outsToAdd
          if (newOuts >= 3) {
            // 3 outs — end of half inning
            const isTop = topBottom === 'top'
            if (isTop) {
              // End of top half — offer bottom of same inning or skip to next
              setShowHalfInningModal({ inning, nextHalf: 'bottom', wasTop: true })
            } else {
              // End of bottom half — advance to top of next inning
              setShowHalfInningModal({ inning, nextHalf: 'top', nextInning: inning + 1, wasTop: false })
            }
            setOuts(0)
            // Clear bases
            setOn1b(false); setOn2b(false); setOn3b(false)
          } else {
            setOuts(newOuts)
          }
        }

        // B-008: Push snapshot to PA undo stack before closing PA
        setPaUndoStack(prev => [...prev.slice(-9), {  // keep last 10 PAs
          lineupPos, outs, on1b, on2b, on3b, ourRuns, oppRuns,
          pa, pitches: paPitches,
        }])

        setActivePA(null)
        setPAPitches([])
        setBalls(0)
        setStrikes(0)
        setManualBatterName('')
      }

      // Reset pitch selections
      setSelectedZone(null)
      setSelectedOutcome(null)
      setInPlayDetail({ outcome_inplay: '', fielder: '', location: '', runs_scored: 0, rbi: 0, foul_location: '' })
      // Keep pitch type selected for quick repeat
    } catch (e) { toast.error(`Failed to record pitch: ${e.message}`) }
  }

  async function handleUndo() {
    // B-003/B-008: Two-level undo
    // Level 1 (in-PA): remove last pitch from current PA
    // Level 2 (post-PA): restore previous PA's game state

    if (paPitches.length > 0) {
      // ── Level 1: undo last pitch in current PA ──────────────────
      const last = paPitches[paPitches.length - 1]
      if (!last?.pitch_id) return
      try {
        await deletePitch(last.pitch_id)
        const newPAPitches = paPitches.slice(0, -1)
        setPAPitches(newPAPitches)
        setGamePitches(prev => prev.filter(p => p.pitch_id !== last.pitch_id))
        setBalls(last.balls_before)
        setStrikes(last.strikes_before)
        setSelectedZone({ row: last.zone_row, col: last.zone_col })
        setSelectedPitch(last.pitch_type)
        setSelectedOutcome(last.outcome_basic)
      } catch (e) { toast.error(`Undo failed: ${e.message}`) }

    } else if (paUndoStack.length > 0) {
      // ── Level 2: undo last completed PA ──────────────────────────
      const prev = paUndoStack[paUndoStack.length - 1]
      try {
        // Delete all pitches from that PA
        for (const p of prev.pitches) {
          if (p.pitch_id) await deletePitch(p.pitch_id).catch(() => {})
        }
        // Note: PA record left in DB (orphaned is fine — pitches deleted above)
        // Restore game state to pre-PA snapshot
        setLineupPos(prev.lineupPos)
        setOuts(prev.outs)
        setOn1b(prev.on1b); setOn2b(prev.on2b); setOn3b(prev.on3b)
        setOurRuns(prev.ourRuns); setOppRuns(prev.oppRuns)
        setGamePitches(gp => gp.filter(p => !prev.pitches.some(pp => pp.pitch_id === p.pitch_id)))
        setAllPAs(ap => ap.filter(a => a.pa_id !== prev.pa?.pa_id))
        // Pop the stack
        setPaUndoStack(s => s.slice(0, -1))
        setBalls(0); setStrikes(0)
        toast.success('Last at-bat undone')
      } catch (e) { toast.error(`Undo failed: ${e.message}`) }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  // Auth gate
  if (authUser === undefined) return (
    <div style={{ minHeight:'100vh', background:'#050C14', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'#3D6080', letterSpacing:3 }}>LOADING…</div>
    </div>
  )
  if (needsPasswordReset && authUser) return (
    <ResetPasswordScreen onDone={() => setNeedsPasswordReset(false)} />
  )
  if (authUser === null) return <AuthScreen />

  if (!session) {
    return <SetupScreen onGameReady={startSession} onSignOut={handleSignOut} authUser={authUser} />
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await signOut()
    endSession()
    setAuthUser(null)
    toast.info('Signed out')
  }

  // ── End Game ────────────────────────────────────────────────────────────────
  function checkEndGameConditions(newInning, newOurRuns, newOppRuns) {
    const runDiff = Math.abs(newOurRuns - newOppRuns)
    // 10-run rule after 3+ complete innings
    if (runDiff >= 10 && newInning >= 4) {
      setShowEndGameConfirm({ reason: `10-run rule (${newOurRuns}-${newOppRuns} after ${newInning-1} innings)` })
      return
    }
    // After 7th inning complete
    if (newInning > 7) {
      setShowEndGameConfirm({ reason: `7 innings complete` })
    }
  }

  function handleEndGame() {
    setShowEndGameConfirm(null)
    setShowGameSummary(true)
  }

  async function handleExportPDF() {
    try {
      await exportGameSummaryPDF({
        session, gamePitches, allPAs, pitcherName,
        oppLineup, ourRuns, oppRuns, inning
      })
      toast.success('PDF downloaded!')
    } catch(e) {
      toast.error(`PDF export failed: ${e.message}`)
    }
  }

  // Save hitter note for current batter
  async function handleSaveNote(batterName, note) {
    if (!session) return
    try {
      await saveHitterNote(session.team.team_id, session.game.opponent, batterName, note)
      setHitterNotes(prev => ({ ...prev, [batterName]: note }))
    } catch(e) {
      toast.error(`Failed to save note: ${e.message}`)
    }
  }

  // Reload lineup after roster save
  async function handleRosterClose() {
    setShowRoster(false)
    toast.success('Roster saved')
    // Reload both lineups after roster edits
    const opp = await getOpponentLineup(session.team.team_id, session.game.opponent).catch(() => [])
    const our = await getPlayers(session.team.team_id).catch(() => [])
    setOppLineup(opp)
    setOurLineup(our)
    // Re-split active lineup based on current half + lineupMode
    const active = topBottom === 'bottom' ? our : opp
    if (active.length > 0) {
      const { starters, bench } = splitLineup(active, lineupMode)
      setLineup(starters)
      setSubs(bench)
      setLineupPos(0)
    }
  }

  // B-019: Double play requires at least one runner on base (Rule 14.22.1)
  const isDPAttempt = selectedOutcome === 'IP' && 
    (inPlayDetail.outcome_inplay === 'Double Play' || inPlayDetail.outcome_inplay === 'DP (FC)')
  const dpBlockedNoRunners = isDPAttempt && !on1b && !on2b && !on3b
  // Sac Fly illegal with 2 outs (Rule 14.9.1 — fewer than 2 outs required)
  const isSacFlyAttempt = selectedOutcome === 'IP' && inPlayDetail.outcome_inplay === 'Sac Fly'
  const sacFlyBlocked = isSacFlyAttempt && outs >= 2
  const canRecord = !!(selectedZone && selectedPitch && selectedOutcome) && !dpBlockedNoRunners && !sacFlyBlocked
  const canUndo   = paPitches.length > 0 || paUndoStack.length > 0  // B-003/B-008: two-level undo

  // ── In-game substitution: swap sub into lineup slot, move starter to bench ────
  function handleSubstitution(lineupIdx, subPlayer) {
    setLineup(prev => {
      const next = [...prev]
      const outgoing = next[lineupIdx]  // starter leaving
      next[lineupIdx] = { ...subPlayer, lineup_order: outgoing.lineup_order }
      return next
    })
    setSubs(prev => {
      // Remove the sub from bench, add outgoing starter to bench
      const next = prev.filter(p => p.player_id !== subPlayer.player_id)
      const outgoing = lineup[lineupIdx]
      if (outgoing) next.push({ ...outgoing, lineup_order: 99 })
      return next
    })
  }

  // ── Shared props bundle for both layouts ─────────────────────────────────────
  const sharedProps = {
    balls, strikes, outs, inning, topBottom,
    on1b, on2b, on3b, onToggleBase: handleToggleBase,
    ourRuns, oppRuns, onScoreChange: handleScoreChange,
    onInningChange: () => setShowHalfInningModal({ inning, nextHalf: topBottom === 'top' ? 'bottom' : 'top', nextInning: topBottom === 'bottom' ? inning + 1 : inning }),
    lineup, lineupPos, onSelectBatter: handleSelectBatter,
    subs, onSubstitute: handleSubstitution,
    manualBatterName, onManualBatterName: setManualBatterName,
    currentBatter, batterStats,
    lineupMode, onLineupModeChange: setLineupMode,
    hitterNotes, onSaveNote: handleSaveNote,
    onEndGame: () => setShowEndGameConfirm({ reason: 'manual' }),
    pitchers, pitcherName, onPitcherChange: handlePitcherChange,
    selectedZone, onSelectZone: setSelectedZone,
    selectedPitch, onSelectPitch: setSelectedPitch,
    arsenal, recommendations, aiSource, aiLoading, aiTrigger, signals,
    selectedOutcome, onSelectOutcome: setSelectedOutcome,
    inPlayDetail, onInPlayChange: setInPlayDetail,
    onRecord: handleRecord, onUndo: handleUndo,
    canRecord, canUndo,
    paPitches, onNewPA: handleNewPA,
    signals, pci, reverseSwitch, onApplyRec: handleApplyRec,
    onRoster: () => setShowRoster(true),
    onScorebook: () => setShowScorebook(true),
    gamePitches, session,
    pitcher: pitchers.find(p => p.name === pitcherName) || null,
    Scorebook,
    saveStatus,
  }

  // ── Mobile layout (< 1024px) ──────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden' }}>
        <Header
          ourName={session.team.name}
          oppName={session.game.opponent}
          ourRuns={ourRuns}
          oppRuns={oppRuns}
          inning={inning}
          topBottom={topBottom}
          onScoreChange={handleScoreChange}
          onInningChange={() => setShowHalfInningModal({ inning, nextHalf: topBottom === 'top' ? 'bottom' : 'top', nextInning: topBottom === 'bottom' ? inning + 1 : inning })}
          pitcherName={pitcherName}
          pitchers={pitchers}
          onSignOut={handleSignOut}
          onPitcherChange={handlePitcherChange}
          pitchCount={gamePitches.length}
          saveStatus={saveStatus}
        />
        <MobileLayout {...sharedProps} />
        {showRoster && <RosterTab session={session} onClose={handleRosterClose} lineupMode={lineupMode} />}
        {showHalfInningModal && <HalfInningModal modal={showHalfInningModal} topBottom={topBottom} ourLineup={ourLineup} onChoice={handleHalfInning} />}
      </div>
    )
  }

  // ── Desktop layout (>= 1024px) ────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <Header
        ourName={session.team.name}
        oppName={session.game.opponent}
        ourRuns={ourRuns}
        oppRuns={oppRuns}
        inning={inning}
        topBottom={topBottom}
        onScoreChange={handleScoreChange}
        onInningChange={() => setShowHalfInningModal({ inning, nextHalf: topBottom === 'top' ? 'bottom' : 'top', nextInning: topBottom === 'bottom' ? inning + 1 : inning })}
        pitcherName={pitcherName}
        pitchers={pitchers}
        onPitcherChange={handlePitcherChange}
        pitchCount={gamePitches.length}
        saveStatus={saveStatus}
      />

      {/* View toggle bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', background:'#0C1C2E', borderBottom:'1px solid #1A3550', flexShrink:0 }}>
        <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:8, letterSpacing:2, color:'#3D6080', marginRight:4 }}>VIEW</span>
        {[['chart','⊞ COMMAND CENTER'],['scorebook','≡ SCOREBOOK']].map(([v, label]) => (
          <button key={v} onClick={() => setActiveView(v)} style={{
            background: activeView === v ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${activeView === v ? 'rgba(245,166,35,0.4)' : '#1A3550'}`,
            color: activeView === v ? '#F5A623' : '#7BACC8',
            fontFamily:"'Share Tech Mono', monospace", fontSize:9, letterSpacing:1.5,
            borderRadius:4, padding:'5px 14px', cursor:'pointer', transition:'all 0.12s',
          }}>{label}</button>
        ))}
        <div style={{ marginLeft:'auto', fontFamily:"'Share Tech Mono', monospace", fontSize:8, color:'#3D6080', letterSpacing:1 }}>
          {activeView === 'scorebook' ? `${gamePitches.length} PITCHES LOGGED` : `INN ${inning} · ${topBottom.toUpperCase()}`}
        </div>
      </div>

      {activeView === 'scorebook' ? (
        <div style={{ flex:1, overflow:'hidden' }}>
          <Scorebook
            gamePitches={gamePitches}
            lineup={lineup}
            pitcher={pitchers.find(p => p.name === pitcherName) || null}
            inning={inning}
            topBottom={topBottom}
            session={session}
          />
        </div>
      ) : (

      <div style={{ flex: 1, display:'grid', gridTemplateColumns:'280px 1fr 300px', overflow:'hidden' }}>
        <LeftPanel
          balls={balls}
          strikes={strikes}
          outs={outs}
          on1b={on1b} on2b={on2b} on3b={on3b}
          onToggleBase={handleToggleBase}
          currentBatter={currentBatter}
          lineup={lineup}
          lineupPos={lineupPos}
          onSelectBatter={handleSelectBatter}
          manualBatterName={manualBatterName}
          onManualBatterName={setManualBatterName}
          paPitches={paPitches}
          batterStats={batterStats}
          lineupMode={lineupMode}
          onLineupModeChange={setLineupMode}
          subs={subs}
          onSubstitute={handleSubstitution}
          signals={signals}
          aiSource={aiSource}
          aiLoading={aiLoading}
          aiTrigger={aiTrigger}
        />

        <CenterPanel
          selectedZone={selectedZone}
          onSelectZone={setSelectedZone}
          selectedPitch={selectedPitch}
          onSelectPitch={setSelectedPitch}
          arsenal={arsenal}
          recommendations={recommendations}
          stats={stats}
          paPitches={paPitches}
          balls={balls}
          strikes={strikes}
          pitchTypeBreakdown={breakdown}
        />

        <RightPanel
          recommendations={recommendations}
          effectiveness={effectiveness}
          signals={signals}
          pci={pci}
          reverseSwitch={reverseSwitch}
          onApplyRec={handleApplyRec}
        />
      </div>
      )} {/* end chart/scorebook ternary */}

      {showRoster && <RosterTab session={session} onClose={handleRosterClose} lineupMode={lineupMode} />}

      {/* ── End Game Confirm ── */}
      {showEndGameConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(5,12,20,0.92)', backdropFilter:'blur(4px)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#0C1C2E', border:'1px solid #1A3550', borderRadius:12, padding:32, width:'min(400px,90vw)', textAlign:'center' }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:'#F5A623', letterSpacing:3, marginBottom:8 }}>END GAME?</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'#7BACC8', marginBottom:24, lineHeight:1.5 }}>
              {showEndGameConfirm.reason === 'manual' ? 'End the game and view the final summary?' : `${showEndGameConfirm.reason} — end the game?`}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowEndGameConfirm(null)} style={{ flex:1, padding:'12px 0', background:'transparent', border:'1px solid #1A3550', color:'#7BACC8', borderRadius:6, cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:9, letterSpacing:2 }}>
                KEEP PLAYING
              </button>
              <button onClick={handleEndGame} style={{ flex:1, padding:'12px 0', background:'rgba(245,166,35,0.15)', border:'1px solid rgba(245,166,35,0.5)', color:'#F5A623', borderRadius:6, cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:9, letterSpacing:2 }}>
                END GAME
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Game Summary ── */}
      {showGameSummary && (
        <GameSummary
          session={session}
          gamePitches={gamePitches}
          allPAs={allPAs}
          pitcherName={pitcherName}
          oppLineup={oppLineup}
          ourLineup={ourLineup}
          ourRuns={ourRuns}
          oppRuns={oppRuns}
          inning={inning}
          onClose={() => {
            setShowGameSummary(false)
            endSession()
          }}
          onExportPDF={handleExportPDF}
        />
      )}

      <HalfInningModal modal={showHalfInningModal} topBottom={topBottom} ourLineup={ourLineup} onChoice={handleHalfInning} />

      <BottomConsole
        selectedOutcome={selectedOutcome}
        onSelectOutcome={setSelectedOutcome}
        inPlayDetail={inPlayDetail}
        onInPlayChange={setInPlayDetail}
        onRecord={handleRecord}
        onUndo={handleUndo}
        onRoster={() => setShowRoster(true)}
        onScorebook={() => setActiveView('scorebook')}
        onEndGame={() => setShowEndGameConfirm({ reason: 'manual' })}
        pitchers={pitchers}
        pitcherName={pitcherName}
        onPitcherChange={handlePitcherChange}
        onNewPA={handleNewPA}
        canRecord={canRecord}
        canUndo={canUndo}
        sacFlyBlocked={sacFlyBlocked}
        strikes={strikes}
      />
    </div>
  )
}
