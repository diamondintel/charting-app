import { useState, useEffect } from 'react'
import styles from './RosterTab.module.css'
import {
  getPlayers, getTeams, getPlayersForTeam,
  upsertPlayer, upsertPitcher, updatePlayer, deletePlayer,
  upsertOpponentPlayer, clearOpponentLineup, getOpponentLineup
} from '../lib/db'

const BATTER_TYPES = ['unknown', 'power', 'contact', 'slapper']
const POSITIONS    = ['P','C','1B','2B','3B','SS','LF','CF','RF','DP','FLEX','EH','EP']
const DEFAULT_ARSENAL = ['Fastball', 'Changeup', 'Drop']
const ALL_PITCHES  = ['Fastball','Changeup','Drop','Rise','Curve','Screw','Drop-Curve']

// Batting count per lineup mode (mirrors App.jsx / MobileLayout.jsx)
const LINEUP_MODE_CONFIG = {
  standard:   { batters: 9,  label: 'Standard 9',        desc: '9 bat · 9 play defense' },
  dp_flex:    { batters: 9,  label: 'DP / Flex',          desc: '10 on card · 9 bat · FLEX listed 10th (no bat unless sub)' },
  eh:         { batters: 10, label: 'EH (10 bat)',         desc: '10 bat · 9 play defense · EH offense only' },
  dp_flex_eh: { batters: 10, label: 'DP / Flex + EH',     desc: '11 on card · 10 bat · FLEX listed last (no bat unless sub)' },
  free_sub:   { batters: 0,  label: 'Free Sub / Roster',  desc: 'Full roster bats · batting order fixed' },
}

// ── Small reusable components ─────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <div className={styles.sectionLabel}>{children}</div>
}

function Badge({ color, children }) {
  const colors = {
    power:   { bg: 'rgba(255,77,106,0.15)',   border: 'rgba(255,77,106,0.4)',   text: '#FF4D6A' },
    contact: { bg: 'rgba(0,212,255,0.12)',    border: 'rgba(0,212,255,0.4)',    text: '#00D4FF' },
    slapper: { bg: 'rgba(0,229,160,0.12)',    border: 'rgba(0,229,160,0.4)',    text: '#00E5A0' },
    unknown: { bg: 'rgba(61,96,128,0.2)',     border: 'rgba(61,96,128,0.4)',    text: '#7BACC8' },
  }
  const c = colors[color] || colors.unknown
  return (
    <span className={styles.badge} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {children}
    </span>
  )
}

// ── Pitcher Profile Card ─────────────────────────────────────────────────────

const PITCHING_STYLES = ['power', 'finesse', 'movement']
const HAND_OPTIONS    = [{ val: 'R', label: 'Right' }, { val: 'L', label: 'Left' }]

function PitcherProfileCard({ player, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const speeds = player.pitch_speeds || {}

  function togglePitch(pitch) {
    const cur = player.pitcher_arsenal || []
    onUpdate({ pitcher_arsenal: cur.includes(pitch) ? cur.filter(x => x !== pitch) : [...cur, pitch] })
  }

  function updateSpeed(pitch, val) {
    onUpdate({ pitch_speeds: { ...speeds, [pitch]: val } })
  }

  return (
    <div className={styles.pitcherCard}>
      {/* Summary row — always visible */}
      <div className={styles.pitcherSummary}>
        <div className={styles.pitcherArsenalRow}>
          {(player.pitcher_arsenal || []).map(p => (
            <span key={p} className={styles.arsenalTag}>{p}</span>
          ))}
          {(player.pitcher_arsenal || []).length === 0 && (
            <span className={styles.noArsenal}>No arsenal set</span>
          )}
        </div>
        <button className={styles.expandBtn} onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲ COLLAPSE' : '▼ EDIT PROFILE'}
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className={styles.pitcherEditor}>

          {/* Hand + Style */}
          <div className={styles.pitcherEditorRow}>
            <div className={styles.pitcherField}>
              <div className={styles.pitcherFieldLabel}>THROWS</div>
              <div className={styles.handBtns}>
                {HAND_OPTIONS.map(h => (
                  <button key={h.val}
                    className={`${styles.handBtn} ${(player.throws||'R') === h.val ? styles.handBtnOn : ''}`}
                    onClick={() => onUpdate({ throws: h.val })}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.pitcherField}>
              <div className={styles.pitcherFieldLabel}>STYLE</div>
              <div className={styles.styleBtns}>
                {PITCHING_STYLES.map(s => (
                  <button key={s}
                    className={`${styles.styleBtn} ${(player.pitching_style||'') === s ? styles.styleBtnOn : ''}`}
                    onClick={() => onUpdate({ pitching_style: s })}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Arsenal selection */}
          <div className={styles.pitcherFieldLabel} style={{marginTop:10}}>ARSENAL — SELECT PITCHES THROWN</div>
          <div className={styles.arsenalPills}>
            {ALL_PITCHES.map(pitch => (
              <button key={pitch}
                className={`${styles.arsenalPill} ${(player.pitcher_arsenal||[]).includes(pitch) ? styles.arsenalOn : ''}`}
                onClick={() => togglePitch(pitch)}>
                {pitch}
              </button>
            ))}
          </div>

          {/* Speed ranges for each active pitch */}
          {(player.pitcher_arsenal || []).length > 0 && (
            <>
              <div className={styles.pitcherFieldLabel} style={{marginTop:10}}>PITCH SPEEDS (MPH RANGE, e.g. "58-62")</div>
              <div className={styles.speedGrid}>
                {(player.pitcher_arsenal || []).map(pitch => (
                  <div key={pitch} className={styles.speedRow}>
                    <div className={styles.speedLabel}>{pitch}</div>
                    <input
                      className={styles.speedInput}
                      placeholder="e.g. 58-62"
                      value={speeds[pitch] || ''}
                      onChange={e => updateSpeed(pitch, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Notes */}
          <div className={styles.pitcherFieldLabel} style={{marginTop:10}}>SCOUTING NOTES</div>
          <textarea
            className={styles.notesInput}
            placeholder="e.g. Strong drop movement, telegraphs changeup grip, high release point on rise..."
            value={player.pitcher_notes || ''}
            onChange={e => onUpdate({ pitcher_notes: e.target.value })}
            rows={2}
          />

        </div>
      )}
    </div>
  )
}

// ── Our Roster Section ────────────────────────────────────────────────────────

function OurRoster({ teamId, onRosterChange }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newPlayer, setNewPlayer] = useState({ name:'', jersey:'', position:'', batter_type:'unknown', is_pitcher:false, pitcher_arsenal:[] })
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [teamId])

  async function load() {
    setLoading(true)
    try {
      const ps = await getPlayers(teamId)
      setPlayers(ps)
      onRosterChange?.(ps)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleSaveNew() {
    if (!newPlayer.name.trim()) return
    try {
      await upsertPlayer({ ...newPlayer, team_id: teamId, team_side: 'ours', lineup_order: players.length + 1 })
      setNewPlayer({ name:'', jersey:'', position:'', batter_type:'unknown', is_pitcher:false, pitcher_arsenal:[] })
      setAddingNew(false)
      load()
    } catch(e) { setError(e.message) }
  }

  async function handleUpdate(player, updates) {
    try {
      await updatePlayer(player.player_id, updates)
      load()
    } catch(e) { setError(e.message) }
  }

  async function handleDelete(playerId) {
    if (!confirm('Remove this player?')) return
    try {
      await deletePlayer(playerId)
      load()
    } catch(e) { setError(e.message) }
  }

  async function moveLineup(player, dir) {
    const sorted = [...players].sort((a,b) => a.lineup_order - b.lineup_order)
    const idx = sorted.findIndex(p => p.player_id === player.player_id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const swap = sorted[swapIdx]
    await updatePlayer(player.player_id, { lineup_order: swap.lineup_order })
    await updatePlayer(swap.player_id,   { lineup_order: player.lineup_order })
    load()
  }

  if (loading) return <div className={styles.loading}>Loading roster...</div>

  const sorted = [...players].sort((a,b) => (a.lineup_order||99) - (b.lineup_order||99))

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <SectionLabel>OUR ROSTER</SectionLabel>
        <button className={styles.addBtn} onClick={() => setAddingNew(true)}>+ ADD PLAYER</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Column headers */}
      <div className={styles.playerHeaderRow}>
        <div className={styles.colOrder}>#</div>
        <div className={styles.colJersey}>JERSEY</div>
        <div className={styles.colName}>NAME</div>
        <div className={styles.colPos}>POS</div>
        <div className={styles.colType}>TYPE</div>
        <div className={styles.colPitcher}>PITCHER</div>
        <div className={styles.colActions}></div>
      </div>

      {sorted.map((p, i) => (
        <div key={p.player_id} className={styles.playerRow}>
          {/* Lineup order */}
          <div className={styles.colOrder}>
            <div className={styles.orderBtns}>
              <button onClick={() => moveLineup(p, -1)} disabled={i===0}>▲</button>
              <span>{p.lineup_order || '—'}</span>
              <button onClick={() => moveLineup(p, 1)} disabled={i===sorted.length-1}>▼</button>
            </div>
          </div>

          <div className={styles.colJersey}>
            {editingId === p.player_id
              ? <input className={styles.cellInput} defaultValue={p.jersey} onBlur={e => handleUpdate(p, { jersey: e.target.value })} />
              : <span className={styles.jerseyNum}>#{p.jersey || '?'}</span>
            }
          </div>

          <div className={styles.colName}>
            {editingId === p.player_id
              ? <input className={styles.cellInput} defaultValue={p.name} onBlur={e => handleUpdate(p, { name: e.target.value })} />
              : <span className={styles.playerName}>{p.name}</span>
            }
          </div>

          <div className={styles.colPos}>
            {editingId === p.player_id
              ? <select className={styles.cellSelect} defaultValue={p.position} onBlur={e => handleUpdate(p, { position: e.target.value })}>
                  {POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
                </select>
              : <span className={styles.posTag}>{p.position || '—'}</span>
            }
          </div>

          <div className={styles.colType}>
            <select
              className={styles.typeSelect}
              value={p.batter_type || 'unknown'}
              onChange={e => handleUpdate(p, { batter_type: e.target.value })}
            >
              {BATTER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className={styles.colPitcher}>
            <button
              className={`${styles.toggleBtn} ${p.is_pitcher ? styles.toggleOn : ''}`}
              onClick={() => handleUpdate(p, { is_pitcher: !p.is_pitcher })}
            >
              {p.is_pitcher ? '⚾ PITCHER' : 'NO'}
            </button>
            {p.is_pitcher && (
              <PitcherProfileCard player={p} onUpdate={(updates) => handleUpdate(p, updates)} />
            )}
          </div>

          <div className={styles.colActions}>
            <button className={styles.editBtn} onClick={() => setEditingId(editingId === p.player_id ? null : p.player_id)}>
              {editingId === p.player_id ? '✓' : '✎'}
            </button>
            <button className={styles.deleteBtn} onClick={() => handleDelete(p.player_id)}>✕</button>
          </div>
        </div>
      ))}

      {/* Add new player form */}
      {addingNew && (
        <div className={styles.addForm}>
          <div className={styles.addFormTitle}>NEW PLAYER</div>
          <div className={styles.addFormRow}>
            <input className={styles.addInput} placeholder="Name *" value={newPlayer.name} onChange={e => setNewPlayer(p=>({...p, name:e.target.value}))} />
            <input className={styles.addInput} placeholder="Jersey #" value={newPlayer.jersey} onChange={e => setNewPlayer(p=>({...p, jersey:e.target.value}))} style={{width:80}} />
            <select className={styles.addSelect} value={newPlayer.position} onChange={e => setNewPlayer(p=>({...p, position:e.target.value}))}>
              <option value="">Position</option>
              {POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
            </select>
            <select className={styles.addSelect} value={newPlayer.batter_type} onChange={e => setNewPlayer(p=>({...p, batter_type:e.target.value}))}>
              {BATTER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <label className={styles.addCheckLabel}>
              <input type="checkbox" checked={newPlayer.is_pitcher} onChange={e => setNewPlayer(p=>({...p, is_pitcher:e.target.checked}))} />
              Pitcher
            </label>
          </div>
          {newPlayer.is_pitcher && (
            <div className={styles.addArsenal}>
              <span className={styles.addArsenalLabel}>ARSENAL:</span>
              {ALL_PITCHES.map(pitch => (
                <button key={pitch}
                  className={`${styles.arsenalPill} ${newPlayer.pitcher_arsenal.includes(pitch) ? styles.arsenalOn : ''}`}
                  onClick={() => {
                    const cur = newPlayer.pitcher_arsenal
                    setNewPlayer(p => ({ ...p, pitcher_arsenal: cur.includes(pitch) ? cur.filter(x=>x!==pitch) : [...cur, pitch] }))
                  }}
                >
                  {pitch}
                </button>
              ))}
            </div>
          )}
          <div className={styles.addFormActions}>
            <button className={styles.saveBtn} onClick={handleSaveNew}>SAVE PLAYER</button>
            <button className={styles.cancelBtn} onClick={() => setAddingNew(false)}>CANCEL</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Opponent Lineup Section ───────────────────────────────────────────────────

function OpponentLineup({ teamId, opponentName, lineupMode = 'standard' }) {
  const cfg = LINEUP_MODE_CONFIG[lineupMode] || LINEUP_MODE_CONFIG.standard
  // How many lineup slots to show — free_sub defaults to 12 (full roster, coach adds more)
  const slotCount = cfg.batters > 0 ? cfg.batters : 12
  // In dp_flex we show 10 slots (9 bat + 1 FLEX); in dp_flex_eh show 11 (10 bat + 1 FLEX)
  const totalSlots = lineupMode === 'dp_flex' ? 10 : lineupMode === 'dp_flex_eh' ? 11 : slotCount
  const EMPTY_ROWS = Array.from({ length: totalSlots }, (_, i) => {
    const isFlex = (lineupMode === 'dp_flex' && i === 9) || (lineupMode === 'dp_flex_eh' && i === 10)
    const isEH   = lineupMode === 'dp_flex_eh' && i === 9
    return { spot: i+1, name:'', jersey:'', batter_type:'unknown', position: isFlex ? 'FLEX' : isEH ? 'EH' : '' }
  })

  const [rows, setRows]         = useState(EMPTY_ROWS)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [allTeams, setAllTeams] = useState([])
  const [selectedDbTeam, setSelectedDbTeam] = useState('')
  const [loadingDb, setLoadingDb] = useState(false)

  useEffect(() => {
    getTeams().then(setAllTeams).catch(console.error)
  }, [])

  useEffect(() => {
    if (!opponentName) return
    load()
  }, [teamId, opponentName])

  async function load() {
    setLoading(true)
    try {
      const players = await getOpponentLineup(teamId, opponentName)
      if (players.length > 0) {
        const populated = Array.from({ length: Math.max(totalSlots, players.length) }, (_, i) => {
          const p = players.find(x => x.lineup_order === i+1) || players[i]
          const isFlex = (lineupMode === 'dp_flex' && i === 9) || (lineupMode === 'dp_flex_eh' && i === 10)
          const isEH   = lineupMode === 'dp_flex_eh' && i === 9
          return p
            ? { spot: i+1, name: p.name, jersey: p.jersey||'', batter_type: p.batter_type||'unknown', position: p.position||isFlex?'FLEX':isEH?'EH':'', player_id: p.player_id }
            : { spot: i+1, name:'', jersey:'', batter_type:'unknown', position: isFlex?'FLEX':isEH?'EH':'' }
        })
        setRows(populated)
      }
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleLoadFromDb() {
    if (!selectedDbTeam) return
    setLoadingDb(true)
    setError(null)
    try {
      const players = await getPlayersForTeam(Number(selectedDbTeam))
      if (players.length === 0) { setError('No players found for that team.'); return }
      const populated = players.map((p, i) => ({
        spot: i + 1,
        name: p.name,
        jersey: p.jersey || '',
        batter_type: p.batter_type || 'unknown',
        position: p.position || '',
      }))
      // Pad to at least 9
      while (populated.length < 9) populated.push({ spot: populated.length+1, name:'', jersey:'', batter_type:'unknown', position:'' })
      setRows(populated)
    } catch(e) { setError(e.message) }
    finally { setLoadingDb(false) }
  }

  function updateRow(idx, key, val) {
    setRows(prev => prev.map((r,i) => i===idx ? {...r, [key]:val} : r))
  }

  function addRow() {
    setRows(prev => [...prev, { spot: prev.length+1, name:'', jersey:'', batter_type:'unknown', position:'' }])
  }

  async function handleSave() {
    const filled = rows.filter(r => r.name.trim())
    if (filled.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await clearOpponentLineup(teamId, opponentName)
      for (const [i, row] of filled.entries()) {
        await upsertOpponentPlayer(teamId, opponentName, {
          name: row.name.trim(),
          jersey: row.jersey,
          batter_type: row.batter_type,
          position: row.position,
          lineup_order: i + 1,
        })
      }
      load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleClear() {
    if (!confirm(`Clear entire ${opponentName} lineup?`)) return
    try {
      await clearOpponentLineup(teamId, opponentName)
      setRows(EMPTY_ROWS)
    } catch(e) { setError(e.message) }
  }

  if (!opponentName) return (
    <div className={styles.section}>
      <SectionLabel>OPPONENT LINEUP</SectionLabel>
      <div className={styles.emptyHint}>Start a game first to set the opponent lineup.</div>
    </div>
  )

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <SectionLabel>OPPONENT LINEUP — {opponentName.toUpperCase()}</SectionLabel>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--gold)', marginTop:2, letterSpacing:1 }}>
            {cfg.label} · {totalSlots} slots
            {(lineupMode==='dp_flex'||lineupMode==='dp_flex_eh') && (
              <span style={{color:'var(--purple)', marginLeft:6}}>FLEX in slot {totalSlots}</span>
            )}
          </div>
        </div>
        <div className={styles.headerBtns}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'SAVING...' : '✓ SAVE LINEUP'}
          </button>
          <button className={styles.cancelBtn} onClick={handleClear}>CLEAR ALL</button>
        </div>
      </div>

      {/* ── Load from database ── */}
      <div className={styles.loadFromDb}>
        <div className={styles.loadFromDbLabel}>LOAD ROSTER FROM DATABASE</div>
        <div className={styles.loadFromDbRow}>
          <select
            className={styles.dbTeamSelect}
            value={selectedDbTeam}
            onChange={e => setSelectedDbTeam(e.target.value)}
          >
            <option value="">— Select opponent team —</option>
            {allTeams
              .filter(t => t.team_id !== teamId)
              .map(t => (
                <option key={t.team_id} value={t.team_id}>{t.name}</option>
              ))}
          </select>
          <button
            className={styles.loadDbBtn}
            onClick={handleLoadFromDb}
            disabled={!selectedDbTeam || loadingDb}
          >
            {loadingDb ? 'LOADING...' : '⬇ LOAD ROSTER'}
          </button>
        </div>
        <div className={styles.loadFromDbHint}>
          Loads the selected team's roster into the lineup. You can reorder or edit before saving.
          Current mode: <strong style={{color:'var(--gold)'}}>{cfg.label}</strong> — {cfg.desc}.
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.playerHeaderRow}>
        <div className={styles.colOrder}>SPOT</div>
        <div className={styles.colJersey}>JERSEY</div>
        <div className={styles.colName}>NAME</div>
        <div className={styles.colPos}>POS</div>
        <div className={styles.colType}>BATTER TYPE</div>
      </div>

      {rows.map((row, i) => (
        <div key={i} className={styles.playerRow}>
          <div className={styles.colOrder}>
            <span className={styles.spotNum}>{row.spot}</span>
            {row.position === 'FLEX' && <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:'var(--purple)',display:'block',letterSpacing:1}}>FLEX</span>}
            {row.position === 'EH' && <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:'var(--cyan)',display:'block',letterSpacing:1}}>EH</span>}
          </div>
          <div className={styles.colJersey}>
            <input className={styles.cellInput} placeholder="#" value={row.jersey}
              onChange={e => updateRow(i, 'jersey', e.target.value)} style={{width:48}} />
          </div>
          <div className={styles.colName}>
            <input className={styles.cellInput} placeholder="Player name" value={row.name}
              onChange={e => updateRow(i, 'name', e.target.value)} />
          </div>
          <div className={styles.colPos}>
            <select className={styles.cellSelect} value={row.position} onChange={e => updateRow(i, 'position', e.target.value)}>
              <option value="">—</option>
              {POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
            </select>
          </div>
          <div className={styles.colType}>
            <select className={styles.typeSelect} value={row.batter_type} onChange={e => updateRow(i, 'batter_type', e.target.value)}>
              {BATTER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      ))}

      <button className={styles.addRowBtn} onClick={addRow}>+ ADD BATTER</button>
      <div className={styles.saveHint}>
        Hit <strong>SAVE LINEUP</strong> to write all batters to the database.
      </div>
    </div>
  )
}

// ── Main RosterTab ────────────────────────────────────────────────────────────

export default function RosterTab({ session, onClose, lineupMode = 'standard' }) {
  const [tab, setTab] = useState('ours')
  const cfg = LINEUP_MODE_CONFIG[lineupMode] || LINEUP_MODE_CONFIG.standard

  if (!session) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>ROSTER MANAGEMENT</div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div className={styles.headerSub}>{session.team.name}</div>
            <span style={{
              fontFamily:"'Share Tech Mono',monospace", fontSize:9, letterSpacing:1,
              color:'var(--gold)', background:'rgba(245,166,35,0.1)',
              border:'1px solid rgba(245,166,35,0.3)', borderRadius:3, padding:'2px 8px'
            }}>
              {cfg.label}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕ CLOSE</button>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab==='ours' ? styles.tabActive : ''}`} onClick={() => setTab('ours')}>
            OUR ROSTER
          </button>
          <button className={`${styles.tab} ${tab==='opponent' ? styles.tabActive : ''}`} onClick={() => setTab('opponent')}>
            OPPONENT LINEUP
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'ours'
            ? <OurRoster teamId={session.team.team_id} />
            : <OpponentLineup teamId={session.team.team_id} opponentName={session.game.opponent} lineupMode={lineupMode} />
          }
        </div>
      </div>
    </div>
  )
}
