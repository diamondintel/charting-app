import { useState, useEffect, useCallback } from 'react'
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
  getTeams, getGames, createGame, deleteGame,
  getOpponentLineup, getPlayers, getPitchers,
  createPA, updatePAResult,
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
function SetupScreen({ onGameReady }) {
  const [teams, setTeams]               = useState([])
  const [games, setGames]               = useState([])
  const [showAllGames, setShowAllGames] = useState(false)
  const [pitchers, setPitchers]         = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedPitcher, setSelectedPitcher] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [opponent, setOpponent]         = useState('')
  const [gameDate, setGameDate]         = useState(new Date().toISOString().split('T')[0])
  const [error, setError]               = useState(null)

  useEffect(() => {
    getTeams().then(setTeams).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedTeam) return
    getGames(selectedTeam.team_id).then(setGames).catch(console.error)
    getPitchers(selectedTeam.team_id).then(ps => {
      setPitchers(ps)
      setSelectedPitcher(ps.length > 0 ? ps[0] : null)
    }).catch(console.error)
  }, [selectedTeam])

  async function handleCreateGame() {
    if (!selectedTeam || !opponent) return
    try {
      const game = await createGame(selectedTeam.team_id, opponent, gameDate)
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
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:24, padding:40 }}>
      <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:32, fontWeight:700, color:'var(--gold)', letterSpacing:4 }}>
        PITCH INTELLIGENCE
      </div>
      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:'var(--text-dim)', letterSpacing:4 }}>
        COMMAND CENTER
      </div>

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
              <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, letterSpacing:3, color:'var(--text-dim)', marginBottom:10 }}>NEW GAME</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <select
                  value={opponent}
                  onChange={e => setOpponent(e.target.value)}
                  style={{ background:'var(--panel)', border:'1px solid var(--border)', color: opponent ? 'var(--text-primary)' : 'var(--text-dim)', borderRadius:4, padding:'8px 10px', fontSize:14, fontFamily:"'DM Sans', sans-serif", cursor:'pointer' }}
                >
                  <option value="">— Select opponent —</option>
                  {teams
                    .filter(t => t.team_id !== selectedTeam?.team_id)
                    .map(t => <option key={t.team_id} value={t.name}>{t.name}</option>)
                  }
                  <option value="__custom__">+ Other (type name)</option>
                </select>
                {opponent === '__custom__' && (
                  <input
                    placeholder="Enter opponent name"
                    onChange={e => setOpponent(e.target.value)}
                    style={{ background:'var(--panel)', border:'1px solid var(--gold)', color:'var(--text-primary)', borderRadius:4, padding:'8px 10px', fontSize:14, fontFamily:"'DM Sans', sans-serif", outline:'none' }}
                  />
                )}
                <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} />

                {/* Pitcher selector */}
                {pitchers.length > 0 && (
                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, letterSpacing:3, color:'var(--text-dim)' }}>STARTING PITCHER</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {pitchers.map(p => {
                        const isSelected = selectedPitcher?.player_id === p.player_id
                        return (
                          <div
                            key={p.player_id}
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
                            {/* Notes */}
                            {p.pitcher_notes && (
                              <div style={{ marginTop:5, fontFamily:"'DM Sans', sans-serif", fontSize:11, color:'var(--text-secondary)', fontStyle:'italic' }}>
                                {p.pitcher_notes}
                              </div>
                            )}
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
    </div>
  )
}

// ─── Half Inning Modal ────────────────────────────────────────────────────────
function HalfInningModal({ modal, topBottom, ourLineup, onChoice }) {
  if (!modal) return null
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
          {topBottom === 'top' ? `END OF TOP ${modal.inning}` : `END OF INNING ${modal.inning}`}
        </div>
        <div style={{ fontFamily:"'Bebas Neue','Rajdhani',sans-serif", fontSize:40, color:'#F5A623', letterSpacing:4, marginBottom:8 }}>
          3 OUTS
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'#7BACC8', marginBottom:28, lineHeight:1.5 }}>
          {topBottom === 'top'
            ? `Inning ${modal.inning} top half complete. What's next?`
            : `Inning ${modal.inning} complete. Advancing to inning ${modal.nextInning}.`}
        </div>
        {topBottom === 'top' ? (
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
  const [session, setSession] = useState(null) // { team, game, savedState? }
  const [showRoster, setShowRoster] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
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
  const [subs, setSubs]             = useState([])   // bench / substitutes not yet in lineup
  const [ourLineup, setOurLineup]   = useState([])   // full Lady Hawks roster (starters + subs)
  const [oppLineup, setOppLineup]   = useState([])   // full opponent roster (starters + subs)
  const [lineupPos, setLineupPos]   = useState(0)
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
  const [inPlayDetail, setInPlayDetail] = useState({ outcome_inplay: '', fielder: '', location: '', runs_scored: 0, rbi: 0 })

  // ── Pitch data ────────────────────────────────────────────────────────────────
  const [gamePitches, setGamePitches]   = useState([])
  const [paPitches, setPAPitches]       = useState([])  // pitches this PA
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

  // ── Load roster + pitches when session starts ─────────────────────────────────
  useEffect(() => {
    if (!session) return
    const { team, game, savedState } = session

    // Load opponent lineup — split into starters vs subs
    getOpponentLineup(team.team_id, game.opponent).then(l => {
      console.log(`[Lineup Load] ${game.opponent}: ${l.length} players from DB`, l.map(p => `${p.lineup_order}:${p.name}`))
      setOppLineup(l)
      const { starters, bench } = splitLineup(l, lineupMode)
      console.log(`[Lineup Split] starters=${starters.length} bench=${bench.length}`)
      setLineup(starters)
      setSubs(bench)
      setLineupPos(0)
    }).catch(console.error)

    // Load our lineup (Lady Hawks batting order)
    getPlayers(team.team_id).then(l => {
      setOurLineup(l)
    }).catch(console.error)

    // Load pitchers — use pre-selected pitcher from setup if available
    getPitchers(team.team_id).then(ps => {
      setPitchers(ps)
      // Use pitcher chosen on setup screen, fall back to first pitcher, then default
      const chosen = session?.pitcher || ps[0] || null
      if (chosen) {
        setPitcherName(chosen.name)
        setArsenal(chosen.pitcher_arsenal?.length ? chosen.pitcher_arsenal : DEFAULT_ARSENAL)
      } else {
        setPitcherName('Pitcher')
        setArsenal(DEFAULT_ARSENAL)
      }
    }).catch(console.error)

    // Load existing game pitches
    getPitchesForGame(game.game_id).then(setGamePitches).catch(console.error)
    getPAsForGame(game.game_id).then(setAllPAs).catch(console.error)

    // Restore saved game state if resuming
    if (savedState) {
      setInning(savedState.inning ?? 1)
      setTopBottom(savedState.top_bottom ?? 'top')
      setOuts(savedState.outs ?? 0)
      setOurRuns(savedState.our_runs ?? 0)
      setOppRuns(savedState.opp_runs ?? 0)
      setOn1b(savedState.on1b ?? false)
      setOn2b(savedState.on2b ?? false)
      setOn3b(savedState.on3b ?? false)
      setLineupPos(savedState.lineup_pos ?? 0)
      setLineupMode(savedState.lineup_mode ?? 'standard')
      if (savedState.pitcher_name) setPitcherName(savedState.pitcher_name)
    }
  }, [session])

  // ── Auto-save game state after every significant change (debounced 1.5s) ──────
  useEffect(() => {
    if (!session?.game?.game_id) return
    setSaveStatus('saving')
    const timer = setTimeout(async () => {
      try {
        await saveGameState(session.game.game_id, {
          inning, topBottom, outs,
          ourRuns, oppRuns,
          on1b, on2b, on3b,
          lineupPos, pitcherName, lineupMode,
          activePaId: activePA?.pa_id || null,
        })
        setSaveStatus('saved')
        // Reset to idle after 2s
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch (e) {
        console.error('Auto-save failed:', e)
        setSaveStatus('error')
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [inning, topBottom, outs, ourRuns, oppRuns, on1b, on2b, on3b, lineupPos, pitcherName, lineupMode, activePA])

  // ── Rebuild lineup from PA history if roster is incomplete ───────────────────
  // Handles case where opponent roster in DB has fewer players than were actually
  // charted (e.g. lineup was never saved to roster tab, but PAs were recorded)
  useEffect(() => {
    if (topBottom !== 'top') return           // only applies to opponent batting
    if (lineup.length >= 9) return            // lineup already full — no action needed
    if (allPAs.length === 0) return           // no history to rebuild from

    // Build ordered list of unique batters from PA history by lineup_spot
    const seen = new Map()
    const sorted = [...allPAs].sort((a, b) => (a.lineup_spot || 0) - (b.lineup_spot || 0))
    for (const pa of sorted) {
      if (pa.batter_name && !seen.has(pa.lineup_spot)) {
        seen.set(pa.lineup_spot, {
          name: pa.batter_name,
          jersey: '?',
          batter_type: 'unknown',
          lineup_order: pa.lineup_spot || seen.size + 1,
          player_id: `pa_${pa.lineup_spot}`,
        })
      }
    }
    if (seen.size <= lineup.length) return    // PA history doesn't add anything new

    const rebuilt = Array.from(seen.values()).sort((a, b) => a.lineup_order - b.lineup_order)
    console.log(`Rebuilt lineup from PA history: ${rebuilt.length} batters (was ${lineup.length})`)
    setLineup(rebuilt)
  }, [allPAs, oppLineup, topBottom])

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

  const signals   = generateSignals(paPitches, balls, strikes, currentBatter?.batter_type, {
    gamePitches,
    batterName:          currentBatter?.name,
    batterPlayer:        currentBatter,
    pitcher:             pitchers.find(p => p.name === pitcherName) || null,
    inning, outs, on1b, on2b, on3b, ourRuns, oppRuns,
    allHistoricalPitches: [],
  })
  const recommendations = generateRecommendations(
    paPitches, balls, strikes, currentBatter?.batter_type || 'unknown', arsenal,
    { pci, lm, prr, gamePitches, batterName: currentBatter?.name }
  )

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
    else setOn3b(v => !v)
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
      // Skip bottom — go to top of next inning, opponent bats
      setInning(m.nextInning || m.inning + 1)
      setTopBottom('top')
      const { starters: skipStarters, bench: skipBench } = splitLineup(oppLineup, lineupMode)
      setLineup(skipStarters)
      setSubs(skipBench)
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
    } else if (choice === 'next') {
      // End of bottom — advance to top of next inning, opponent bats
      setInning(m.nextInning || m.inning + 1)
      setTopBottom('top')
      const { starters, bench } = splitLineup(oppLineup, lineupMode)
      setLineup(starters)
      setSubs(bench)
    }
    setLineupPos(0)
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
      } catch (e) { console.error(e); return }
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
      const paOver      = isStrikeout || isWalk || isHBP || isInPlay

      // Batter is out on: strikeout, or in-play non-hit
      const HIT_RESULTS = new Set(['Single','Double','Triple','Home Run','Sac Fly'])
      const batterOut   = isStrikeout
                       || (isInPlay && !HIT_RESULTS.has(inPlayDetail.outcome_inplay) && inPlayDetail.outcome_inplay !== '')

      if (paOver) {
        // Update PA result
        if (pa) {
          await updatePAResult(pa.pa_id, selectedOutcome)
          setAllPAs(prev => [...prev, { ...pa, pa_result: selectedOutcome }])
        }

        // ── Baserunner advancement ──────────────────────────────────────
        const result = inPlayDetail.outcome_inplay
        if (isInPlay) {
          // Capture current base state before any mutations
          const was1b = on1b, was2b = on2b, was3b = on3b
          if (result === 'Home Run') {
            const runsScored = 1 + (was1b ? 1 : 0) + (was2b ? 1 : 0) + (was3b ? 1 : 0)
            setOppRuns(r => r + runsScored)
            setOn1b(false); setOn2b(false); setOn3b(false)
          } else if (result === 'Triple') {
            const runsScored = (was1b ? 1 : 0) + (was2b ? 1 : 0) + (was3b ? 1 : 0)
            setOppRuns(r => r + runsScored)
            setOn1b(false); setOn2b(false); setOn3b(true)
          } else if (result === 'Double') {
            const runsScored = (was2b ? 1 : 0) + (was3b ? 1 : 0)
            setOppRuns(r => r + runsScored)
            setOn1b(false); setOn2b(true); setOn3b(was1b)
          } else if (result === 'Single') {
            const runsScored = (was3b ? 1 : 0)
            setOppRuns(r => r + runsScored)
            setOn1b(true); setOn2b(was1b); setOn3b(was2b)
          } else if (result === 'Sac Fly') {
            if (was3b) { setOppRuns(r => r + 1); setOn3b(false) }
          } else if (result === 'Fielder Choice') {
            setOn1b(true)
          } else if (result === 'Error') {
            setOn1b(true)
          }
          if (!['Single','Double','Triple','Home Run','Sac Fly'].includes(result) && inPlayDetail.runs_scored > 0) {
            setOppRuns(r => r + inPlayDetail.runs_scored)
          }
        } else if (isWalk || isHBP) {
          // Walk/HBP — force runners with captured state
          const was1b = on1b, was2b = on2b, was3b = on3b
          if (was1b && was2b && was3b) { setOppRuns(r => r + 1); }
          setOn3b(was1b && was2b ? true : was3b)
          setOn2b(was1b ? true : was2b)
          setOn1b(true)
        }

        // ── Advance to next batter ────────────────────────────────────
        // lineup already contains only starters (splitLineup handles mode logic)
        // so we simply cycle through lineup.length — no further filtering needed
        if (lineup.length > 0) {
          const nextPos = (lineupPos + 1) % lineup.length
          setLineupPos(nextPos)
          if (nextPos === 0) console.log('Lineup cycling: back to top of order')
        }

        // ── Update outs + handle inning change ─────────────────────────
        if (batterOut) {
          const newOuts = outs + 1
          if (newOuts >= 3) {
            // 3 outs — end of half inning
            const isTop = topBottom === 'top'
            if (isTop) {
              // End of top half — offer bottom of same inning or skip to next
              setShowHalfInningModal({ inning, nextHalf: 'bottom' })
            } else {
              // End of bottom half — advance to top of next inning
              setShowHalfInningModal({ inning, nextHalf: 'top', nextInning: inning + 1 })
            }
            setOuts(0)
            // Clear bases
            setOn1b(false); setOn2b(false); setOn3b(false)
          } else {
            setOuts(newOuts)
          }
        }

        setActivePA(null)
        setPAPitches([])
        setBalls(0)
        setStrikes(0)
        setManualBatterName('')
      }

      // Reset pitch selections
      setSelectedZone(null)
      setSelectedOutcome(null)
      setInPlayDetail({ outcome_inplay: '', fielder: '', location: '', runs_scored: 0, rbi: 0 })
      // Keep pitch type selected for quick repeat
    } catch (e) { console.error(e) }
  }

  async function handleUndo() {
    const last = paPitches[paPitches.length - 1]
    if (!last?.pitch_id) return
    try {
      await deletePitch(last.pitch_id)
      const newPAPitches = paPitches.slice(0, -1)
      setPAPitches(newPAPitches)
      setGamePitches(prev => prev.filter(p => p.pitch_id !== last.pitch_id))
      // Restore count
      setBalls(last.balls_before)
      setStrikes(last.strikes_before)
      setSelectedZone({ row: last.zone_row, col: last.zone_col })
      setSelectedPitch(last.pitch_type)
      setSelectedOutcome(last.outcome_basic)
    } catch (e) { console.error(e) }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!session) {
    return <SetupScreen onGameReady={setSession} />
  }

  // Reload lineup after roster save
  async function handleRosterClose() {
    setShowRoster(false)
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

  const canRecord = !!(selectedZone && selectedPitch && selectedOutcome)
  const canUndo   = paPitches.length > 0

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
    pitchers, pitcherName, onPitcherChange: handlePitcherChange,
    selectedZone, onSelectZone: setSelectedZone,
    selectedPitch, onSelectPitch: setSelectedPitch,
    arsenal, recommendations,
    selectedOutcome, onSelectOutcome: setSelectedOutcome,
    inPlayDetail, onInPlayChange: setInPlayDetail,
    onRecord: handleRecord, onUndo: handleUndo,
    canRecord, canUndo,
    paPitches, onNewPA: handleNewPA,
    signals, pci, reverseSwitch, onApplyRec: handleApplyRec,
    onRoster: () => setShowRoster(true),
    onScorebook: () => setActiveView('scorebook'),
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

      {showScorebook && (
        <Scorebook
          onClose={() => setShowScorebook(false)}
          gamePitches={gamePitches}
          lineup={oppLineup}
          ourLineup={ourLineup}
          session={session}
          inning={inning}
          topBottom={topBottom}
          pitchers={pitchers}
          pitcherName={pitcherName}
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
        onScorebook={() => setShowScorebook(true)}
        pitchers={pitchers}
        pitcherName={pitcherName}
        onPitcherChange={handlePitcherChange}
        onNewPA={handleNewPA}
        canRecord={canRecord}
        canUndo={canUndo}
      />
    </div>
  )
}
