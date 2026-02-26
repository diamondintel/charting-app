import { useState, useEffect } from 'react'
import { getPitcherScoutingData } from '../lib/db.js'

const C = {
  bg:     '#050C14',
  panel:  '#0C1C2E',
  border: '#1A3550',
  pri:    '#E8F4F8',
  sec:    '#7BACC8',
  dim:    '#3D6080',
  gold:   '#F5A623',
  cyan:   '#00D4FF',
  green:  '#00E5A0',
  red:    '#FF5050',
}
const mono = "'Share Tech Mono', monospace"
const sans = "'DM Sans', sans-serif"
const bebas = "'Bebas Neue', 'Rajdhani', sans-serif"

function StatBox({ label, value, sub, color = C.gold }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: bebas, fontSize: 28, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: bebas, fontSize: 13, color: C.sec, lineHeight: 1 }}>{sub}</div>}
      <div style={{ fontFamily: mono, fontSize: 7, color: C.dim, letterSpacing: 2, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function PitchBar({ type, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: mono, fontSize: 9, color: C.sec, letterSpacing: 1 }}>{type}</span>
        <span style={{ fontFamily: mono, fontSize: 9, color: C.dim }}>{count} · {pct}%</span>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function GameRow({ game, pitches, pas }) {
  const gamePitches = pitches.filter(p => p.game_id === game.game_id)
  const strikes = gamePitches.filter(p => ['CK','SK','F'].includes(p.outcome_basic)).length
  const strikeRate = gamePitches.length > 0 ? Math.round((strikes / gamePitches.length) * 100) : 0
  const ks = pas.filter(p => p.game_id === game.game_id && ['CK','SK'].includes(p.pa_result)).length
  const date = game.game_date ? new Date(game.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 40px 40px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: mono, fontSize: 9, color: C.dim }}>{date}</span>
      <span style={{ fontFamily: sans, fontSize: 12, color: C.pri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.opponent}</span>
      <span style={{ fontFamily: bebas, fontSize: 16, color: C.gold, textAlign: 'center' }}>{gamePitches.length}</span>
      <span style={{ fontFamily: bebas, fontSize: 16, color: strikeRate >= 60 ? C.green : C.sec, textAlign: 'center' }}>{strikeRate}%</span>
      <span style={{ fontFamily: bebas, fontSize: 16, color: C.cyan, textAlign: 'center' }}>{ks}</span>
    </div>
  )
}

export default function PitcherScoutingReport({ teamId, pitcherName, opponentFilter, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'byopponent' | 'recent'

  useEffect(() => {
    if (!teamId || !pitcherName) return
    setLoading(true)
    getPitcherScoutingData(teamId, pitcherName)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [teamId, pitcherName])

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,20,0.95)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: C.cyan, letterSpacing: 3 }}>LOADING SCOUTING DATA…</div>
    </div>
  )

  if (!data || data.pitches.length === 0) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,20,0.95)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: bebas, fontSize: 32, color: C.gold, letterSpacing: 4 }}>NO DATA YET</div>
      <div style={{ fontFamily: sans, fontSize: 13, color: C.sec }}>No pitch history found for {pitcherName}</div>
      <button onClick={onClose} style={{ padding: '8px 24px', background: 'transparent', border: `1px solid ${C.border}`, color: C.sec, borderRadius: 4, cursor: 'pointer', fontFamily: mono, fontSize: 9, letterSpacing: 2 }}>CLOSE</button>
    </div>
  )

  // ── Compute stats ──────────────────────────────────────────────────────────
  const { games, pitches, pas } = data

  // Filter to games where this pitcher threw
  const pitcherGameIds = new Set(pitches.map(p => p.game_id))
  const pitcherGames = games.filter(g => pitcherGameIds.has(g.game_id))

  const totalPitches = pitches.length
  const strikes = pitches.filter(p => ['CK','SK','F'].includes(p.outcome_basic)).length
  const balls = pitches.filter(p => p.outcome_basic === 'B').length
  const strikeRate = totalPitches > 0 ? Math.round((strikes / totalPitches) * 100) : 0
  const totalKs = pas.filter(p => pitcherGameIds.has(p.game_id) && ['CK','SK'].includes(p.pa_result)).length
  const totalInPlay = pas.filter(p => pitcherGameIds.has(p.game_id) && p.pa_result === 'IP').length

  // Pitch type breakdown
  const pitchTypes = {}
  pitches.forEach(p => {
    const t = p.pitch_type || 'Unknown'
    pitchTypes[t] = (pitchTypes[t] || 0) + 1
  })

  const PITCH_COLORS = { Fastball: '#00D4FF', Drop: '#F5A623', Changeup: '#00E5A0', Rise: '#FF6B6B', Curve: '#A78BFA', Screwball: '#F59E0B', 'Drop-Curve': '#EC4899' }

  // By opponent breakdown
  const byOpponent = {}
  pitcherGames.forEach(g => {
    if (!byOpponent[g.opponent]) byOpponent[g.opponent] = { games: 0, pitches: 0, ks: 0, strikes: 0 }
    const gp = pitches.filter(p => p.game_id === g.game_id)
    const gks = pas.filter(p => p.game_id === g.game_id && ['CK','SK'].includes(p.pa_result)).length
    byOpponent[g.opponent].games++
    byOpponent[g.opponent].pitches += gp.length
    byOpponent[g.opponent].ks += gks
    byOpponent[g.opponent].strikes += gp.filter(p => ['CK','SK','F'].includes(p.outcome_basic)).length
  })

  // Recent form — last 3 games
  const recentGames = pitcherGames.slice(0, 3)

  const TABS = ['overview', 'byopponent', 'recent']
  const TAB_LABELS = { overview: 'OVERVIEW', byopponent: 'VS OPPONENT', recent: 'RECENT FORM' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,20,0.96)', zIndex: 400, overflowY: 'auto' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 8, color: C.dim, letterSpacing: 3, marginBottom: 4 }}>PITCHER SCOUTING REPORT</div>
            <div style={{ fontFamily: bebas, fontSize: 36, color: C.pri, letterSpacing: 2, lineHeight: 1 }}>{pitcherName}</div>
            <div style={{ fontFamily: mono, fontSize: 9, color: C.cyan, marginTop: 4 }}>{pitcherGames.length} GAMES · {totalPitches} PITCHES</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.sec, borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontFamily: mono, fontSize: 9, letterSpacing: 2 }}>✕ CLOSE</button>
        </div>

        {/* Opponent highlight banner */}
        {opponentFilter && byOpponent[opponentFilter] && (() => {
          const opp = byOpponent[opponentFilter]
          const oppSR = opp.pitches > 0 ? Math.round((opp.strikes / opp.pitches) * 100) : 0
          return (
            <div style={{ padding: '10px 14px', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.4)', borderRadius: 6, marginBottom: 16 }}>
              <div style={{ fontFamily: mono, fontSize: 8, color: C.gold, letterSpacing: 2, marginBottom: 6 }}>vs {opponentFilter.toUpperCase()}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div><span style={{ fontFamily: bebas, fontSize: 22, color: C.gold }}>{opp.games}</span><span style={{ fontFamily: mono, fontSize: 8, color: C.dim, marginLeft: 4 }}>GAMES</span></div>
                <div><span style={{ fontFamily: bebas, fontSize: 22, color: C.gold }}>{opp.pitches}</span><span style={{ fontFamily: mono, fontSize: 8, color: C.dim, marginLeft: 4 }}>PITCHES</span></div>
                <div><span style={{ fontFamily: bebas, fontSize: 22, color: oppSR >= 60 ? C.green : C.sec }}>{oppSR}%</span><span style={{ fontFamily: mono, fontSize: 8, color: C.dim, marginLeft: 4 }}>STR%</span></div>
                <div><span style={{ fontFamily: bebas, fontSize: 22, color: C.cyan }}>{opp.ks}</span><span style={{ fontFamily: mono, fontSize: 8, color: C.dim, marginLeft: 4 }}>K'S</span></div>
              </div>
            </div>
          )
        })()}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 4, cursor: 'pointer',
              fontFamily: mono, fontSize: 8, letterSpacing: 2,
              background: activeTab === t ? 'rgba(0,212,255,0.12)' : 'transparent',
              border: `1px solid ${activeTab === t ? 'rgba(0,212,255,0.4)' : C.border}`,
              color: activeTab === t ? C.cyan : C.dim,
            }}>{TAB_LABELS[t]}</button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              <StatBox label="PITCHES" value={totalPitches} />
              <StatBox label="STR %" value={`${strikeRate}%`} color={strikeRate >= 60 ? C.green : C.gold} />
              <StatBox label="K'S" value={totalKs} color={C.cyan} />
              <StatBox label="IN PLAY" value={totalInPlay} color={C.sec} />
            </div>

            <div style={{ padding: '12px 14px', background: C.panel, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontFamily: mono, fontSize: 8, color: C.dim, letterSpacing: 2, marginBottom: 12 }}>PITCH ARSENAL USAGE</div>
              {Object.entries(pitchTypes).sort((a,b) => b[1]-a[1]).map(([type, count]) => (
                <PitchBar key={type} type={type} count={count} total={totalPitches} color={PITCH_COLORS[type] || C.sec} />
              ))}
            </div>
          </>
        )}

        {/* ── BY OPPONENT TAB ── */}
        {activeTab === 'byopponent' && (
          <div style={{ padding: '12px 14px', background: C.panel, borderRadius: 6, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 40px 40px', gap: 8, marginBottom: 8 }}>
              {['DATE', 'OPPONENT', 'P', 'STR%', 'K'].map(h => (
                <span key={h} style={{ fontFamily: mono, fontSize: 7, color: C.dim, letterSpacing: 2 }}>{h}</span>
              ))}
            </div>
            {pitcherGames.map(g => (
              <GameRow key={g.game_id} game={g} pitches={pitches} pas={pas} />
            ))}
          </div>
        )}

        {/* ── RECENT FORM TAB ── */}
        {activeTab === 'recent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentGames.length === 0 && (
              <div style={{ fontFamily: sans, fontSize: 13, color: C.dim, textAlign: 'center', padding: 32 }}>No recent games</div>
            )}
            {recentGames.map((g, i) => {
              const gp = pitches.filter(p => p.game_id === g.game_id)
              const gStr = gp.filter(p => ['CK','SK','F'].includes(p.outcome_basic)).length
              const gKs = pas.filter(p => p.game_id === g.game_id && ['CK','SK'].includes(p.pa_result)).length
              const gSR = gp.length > 0 ? Math.round((gStr / gp.length) * 100) : 0
              const date = g.game_date ? new Date(g.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
              const ptypes = {}
              gp.forEach(p => { const t = p.pitch_type || 'Unknown'; ptypes[t] = (ptypes[t]||0)+1 })
              return (
                <div key={g.game_id} style={{ padding: '12px 14px', background: C.panel, borderRadius: 6, border: `1px solid ${i === 0 ? 'rgba(0,212,255,0.3)' : C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontFamily: mono, fontSize: 8, color: C.dim }}>{date} · </span>
                      <span style={{ fontFamily: sans, fontSize: 13, color: C.pri, fontWeight: 600 }}>vs {g.opponent}</span>
                      {i === 0 && <span style={{ marginLeft: 8, fontFamily: mono, fontSize: 7, color: C.cyan, background: 'rgba(0,212,255,0.1)', padding: '2px 6px', borderRadius: 3 }}>MOST RECENT</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: bebas, fontSize: 20, color: C.gold, lineHeight: 1 }}>{gp.length}</div>
                        <div style={{ fontFamily: mono, fontSize: 6, color: C.dim }}>PITCHES</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: bebas, fontSize: 20, color: gSR >= 60 ? C.green : C.sec, lineHeight: 1 }}>{gSR}%</div>
                        <div style={{ fontFamily: mono, fontSize: 6, color: C.dim }}>STR%</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: bebas, fontSize: 20, color: C.cyan, lineHeight: 1 }}>{gKs}</div>
                        <div style={{ fontFamily: mono, fontSize: 6, color: C.dim }}>K'S</div>
                      </div>
                    </div>
                  </div>
                  {Object.entries(ptypes).sort((a,b) => b[1]-a[1]).map(([type, count]) => (
                    <PitchBar key={type} type={type} count={count} total={gp.length} color={PITCH_COLORS[type] || C.sec} />
                  ))}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

const PITCH_COLORS = { Fastball: '#00D4FF', Drop: '#F5A623', Changeup: '#00E5A0', Rise: '#FF6B6B', Curve: '#A78BFA', Screwball: '#F59E0B', 'Drop-Curve': '#EC4899' }
