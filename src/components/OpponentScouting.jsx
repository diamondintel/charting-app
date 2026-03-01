import { useState, useEffect, useRef } from 'react'
import {
  saveScoutingBoxScore, getScoutingBoxScores, deleteScoutingBoxScore,
  saveScoutingReport, getScoutingReport
} from '../lib/db'

const gold   = 'var(--gold)'
const cyan   = 'var(--cyan)'
const green  = 'var(--green)'
const red    = 'var(--red)'
const panel  = 'var(--panel)'
const border = 'var(--border)'
const dim    = 'var(--text-dim)'
const primary = 'var(--text-primary)'

// ── Compress image before sending to Claude ───────────────────────────────────
async function compressImage(file) {
  return new Promise((res, rej) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxW = 1200
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      res(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.onerror = rej
    img.src = url
  })
}

// ── Extract box score from a single screenshot via Claude Vision ──────────────
async function extractBoxScore(base64) {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
          },
          {
            type: 'text',
            text: `This is a GameChanger softball box score screenshot. I need to extract stats for ONE specific team only.

CRITICAL RULES:
- GameChanger box scores show ONE team's lineup at a time under a bold team header
- Extract ONLY the team shown in the bold/highlighted header at the top of the lineup section
- Do NOT extract the opposing team's stats - they are NOT shown in this section
- The "game_vs" field is just the name of who they played against (the other team in the score)
- Batters listed are ONLY players from the primary team shown

Clean up truncated names: "D Ferrar...23" → "D Ferrara", "M Kalei...#99" → "M Kaleikini"

CRITICAL NAME RULES:
- If a name is truncated (ends with "..." or cuts off mid-name), use ONLY what is clearly visible
- Do NOT guess, complete, or invent any part of a name you cannot fully read
- If you can only read a last name clearly, use just the last name
- If you can read an initial + last name like "C Grigg", use exactly "C Grigg" — do not expand to a full first name
- Jersey numbers in the name string (e.g. "Carter Grigg 2032 #8") should be stripped — put number in the jersey field only
- Birth years (2030, 2031, 2032) in the name string should be stripped from the name field

Return ONLY this JSON, no other text:
{
  "team_name": "exact team name from the bold section header e.g. FLORIDA IMPACT PREMIER FERRARA 14U",
  "game_vs": "the OTHER team they played against (shown in score header, NOT in lineup)",
  "game_date": "YYYY-MM-DD if visible, empty string if not",
  "final_score": "score if visible e.g. 3-1",
  "batters": [
    {
      "name": "player full name cleaned up",
      "jersey": "jersey number as string",
      "position": "position abbreviation e.g. SS, CF, P, C, 1B",
      "ab": 0, "r": 0, "h": 0, "rbi": 0, "bb": 0, "so": 0
    }
  ],
  "pitchers": [
    {
      "name": "pitcher name",
      "jersey": "jersey number as string",
      "ip": "5.0", "h": 0, "r": 0, "er": 0, "bb": 0, "so": 0,
      "result": "W or L or empty string"
    }
  ]
}

Include ALL individual batters. Exclude any TEAM totals row.
Return ONLY the JSON.`
          }
        ]
      }]
    })
  })
  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`API ${response.status}: ${err.slice(0, 100)}`)
  }
  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ── Normalize player name — strips birth years and position suffixes ─────────
function normalizeName(raw) {
  if (!raw) return ''
  return raw
    .replace(/\s*\d{4}\s*/g, ' ')   // remove birth years like 2030, 2031, 2032
    .replace(/\s*#\d+\s*/g, ' ')    // remove jersey refs like #8
    .replace(/\s*\([^)]+\)\s*/g, ' ')  // remove position in parens like (SS, 3B)
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Extract jersey number from raw name string ────────────────────────────────
function extractJersey(raw, fallback) {
  if (fallback && fallback !== '0' && fallback !== '') return fallback
  const match = (raw || '').match(/#(\d+)/)
  return match ? match[1] : ''
}

// ── Generate AI scouting report from all box scores ──────────────────────────
async function generateScoutingReport(opponentName, boxScores) {
  // Aggregate stats with normalized names to prevent splitting
  const batterMap  = {}
  const pitcherMap = {}

  for (const game of boxScores) {
    for (const b of (game.batters || [])) {
      const rawName = b.name || ''
      const key     = normalizeName(rawName).toLowerCase()
      if (!key || key === 'team' || key === 'totals') continue

      if (!batterMap[key]) {
        batterMap[key] = {
          name:     normalizeName(rawName),
          jersey:   extractJersey(rawName, b.jersey),
          position: b.position || '',
          games: 0, ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0
        }
      }
      batterMap[key].games += 1
      batterMap[key].ab  += Number(b.ab)  || 0
      batterMap[key].r   += Number(b.r)   || 0
      batterMap[key].h   += Number(b.h)   || 0
      batterMap[key].rbi += Number(b.rbi) || 0
      batterMap[key].bb  += Number(b.bb)  || 0
      batterMap[key].so  += Number(b.so)  || 0
      // Keep most recent jersey/position if missing
      if (!batterMap[key].jersey) batterMap[key].jersey = extractJersey(rawName, b.jersey)
      if (!batterMap[key].position && b.position) batterMap[key].position = b.position
    }

    for (const p of (game.pitchers || [])) {
      const rawName = p.name || ''
      const key     = normalizeName(rawName).toLowerCase()
      if (!key) continue

      if (!pitcherMap[key]) {
        pitcherMap[key] = {
          name:   normalizeName(rawName),
          jersey: extractJersey(rawName, p.jersey),
          games: 0, ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0
        }
      }
      pitcherMap[key].games += 1
      pitcherMap[key].ip += parseFloat(p.ip) || 0
      pitcherMap[key].h  += Number(p.h)  || 0
      pitcherMap[key].r  += Number(p.r)  || 0
      pitcherMap[key].er += Number(p.er) || 0
      pitcherMap[key].bb += Number(p.bb) || 0
      pitcherMap[key].so += Number(p.so) || 0
    }
  }

  // Build structured data objects (not text summaries)
  const batters = Object.values(batterMap)
    .filter(b => b.ab >= 2) // minimum sample
    .sort((a, b) => b.ab - a.ab)
    .map(b => ({
      name:     b.name,
      jersey:   b.jersey ? `#${b.jersey}` : '',
      position: b.position,
      games:    b.games,
      ab:       b.ab,
      h:        b.h,
      avg:      b.ab > 0 ? (b.h / b.ab).toFixed(3) : '.000',
      rbi:      b.rbi,
      bb:       b.bb,
      so:       b.so,
      k_rate:   b.ab > 0 ? Math.round((b.so / b.ab) * 100) : 0,
      contact:  b.ab > 0 ? Math.round(((b.ab - b.so) / b.ab) * 100) : 0,
    }))

  const pitchers = Object.values(pitcherMap)
    .filter(p => p.ip >= 1)
    .sort((a, b) => b.ip - a.ip)
    .map(p => ({
      name:   p.name,
      jersey: p.jersey ? `#${p.jersey}` : '',
      games:  p.games,
      ip:     p.ip.toFixed(1),
      h:      p.h,
      er:     p.er,
      so:     p.so,
      bb:     p.bb,
      era:    p.ip > 0 ? ((p.er / p.ip) * 7).toFixed(2) : '-',
      h_per_ip: p.ip > 0 ? (p.h / p.ip).toFixed(1) : '-',
    }))

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are an elite softball pitching coach. Generate a pre-game scouting report for ${opponentName} based on ${boxScores.length} games of data.

CRITICAL RULES:
- Use ONLY the exact names provided in the data below. Do NOT invent, guess, or alter any player names.
- Use the jersey numbers exactly as provided. Use "" if jersey is empty.
- Base ALL assessments strictly on the stats provided. No speculation.

BATTER DATA (aggregated across all games):
${JSON.stringify(batters, null, 2)}

PITCHER DATA:
${JSON.stringify(pitchers, null, 2)}

Return ONLY this JSON structure, no other text:
{
  "danger_zone": [
    {
      "name": "exact name from data",
      "jersey": "jersey from data or empty string",
      "position": "position from data",
      "threat_level": "HIGH or MEDIUM",
      "stats": "concise stat line e.g. .420 avg, 3 RBI in 4 games",
      "insight": "1-2 sentence tactical coaching insight — specific pitch/zone strategy",
      "tags": ["CONTACT","POWER","SPEED","CLUTCH","PATIENT"]
    }
  ],
  "attack_zone": [
    {
      "name": "exact name from data",
      "jersey": "jersey from data or empty string",
      "position": "position from data",
      "stats": "concise stat line",
      "insight": "why she is an easy out and how to exploit",
      "tags": ["HIGH-K","FREE-OUT","WEAK-CONTACT","CHASE"]
    }
  ],
  "pitcher_intel": [
    {
      "name": "exact name from data",
      "jersey": "jersey from data or empty string",
      "stats": "ERA, H/IP, K stats",
      "insight": "is she hittable? approach at plate vs her?",
      "threat": "HIGH or MEDIUM or LOW"
    }
  ],
  "team_tendencies": "2-3 sentences on overall offensive approach based strictly on the data",
  "game_plan": "4-5 sentence tactical game plan with specific player names from the data"
}

Danger zone: AVG .280+ OR multi-RBI OR low K-rate (under 20%) with contact.
Attack zone: AVG .150 or below OR K-rate 30%+ OR 0 hits in 3+ AB.
Only include players with 2+ AB. Use only names from the data provided.`
      }]
    })
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`API ${response.status}: ${err.slice(0, 100)}`)
  }
  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ── Generate AI scouting report from all box scores ──────────────────────────

// ── Main Component ────────────────────────────────────────────────────────────
export default function OpponentScouting({ teamId, opponentName, onClose }) {
  const [boxScores, setBoxScores]       = useState([])
  const [report, setReport]             = useState(null)
  const [uploading, setUploading]       = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError]               = useState(null)
  const [view, setView]                 = useState('report') // 'report' | 'games'
  const [pendingBoxScores, setPendingBoxScores] = useState([]) // awaiting team confirmation
  const fileInputRef = useRef()

  useEffect(() => { load() }, [teamId, opponentName])

  async function load() {
    try {
      const [scores, rep] = await Promise.all([
        getScoutingBoxScores(teamId, opponentName),
        getScoutingReport(teamId, opponentName),
      ])
      setBoxScores(scores)
      setReport(rep?.report || null)
    } catch(e) { setError(e.message) }
  }

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    setError(null)

    const pending = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress(`Extracting ${i + 1} of ${files.length}: ${file.name}`)
      try {
        const base64    = await compressImage(file)
        const extracted = await extractBoxScore(base64)
        pending.push({
          extracted,
          fileName: file.name,
          confirmed: true, // default confirmed, coach can toggle
          teamNameOverride: '', // coach can correct team name
        })
      } catch(e) {
        console.error(`Failed: ${file.name}`, e)
      }
    }

    setUploadProgress('')
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (pending.length > 0) {
      setPendingBoxScores(pending)
    } else {
      setError('No box scores could be processed. Try clearer screenshots.')
    }
  }

  async function handleConfirmSave() {
    const toSave = pendingBoxScores.filter(p => p.confirmed)
    if (!toSave.length) { setPendingBoxScores([]); return }

    setUploading(true)
    setError(null)
    let count = 0
    for (const item of toSave) {
      try {
        await saveScoutingBoxScore(teamId, opponentName, {
          game_date:     item.extracted.game_date || null,
          game_vs:       item.extracted.game_vs   || null,
          raw_extracted: item.extracted,
          batters:       item.extracted.batters   || [],
          pitchers:      item.extracted.pitchers  || [],
        })
        count++
      } catch(e) { console.error('Save failed:', e) }
    }
    setPendingBoxScores([])
    setUploading(false)
    if (count > 0) {
      await load()
      await handleGenerateReport()
    }
  }

  async function handleGenerateReport() {
    setGenerating(true)
    setError(null)
    try {
      const scores = await getScoutingBoxScores(teamId, opponentName)
      if (scores.length === 0) { setError('Upload at least one box score first.'); return }
      const rep = await generateScoutingReport(opponentName, scores)
      await saveScoutingReport(teamId, opponentName, rep, scores.length)
      setReport(rep)
      setView('report')
    } catch(e) {
      setError(`Report generation failed: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this box score?')) return
    try {
      await deleteScoutingBoxScore(id)
      await load()
    } catch(e) { setError(e.message) }
  }

  const threatColor = (t) => t === 'HIGH' ? red : t === 'MEDIUM' ? gold : green

  const tagColors = {
    'CONTACT': 'rgba(0,212,255,0.15)',  'POWER': 'rgba(245,166,35,0.15)',
    'SPEED':   'rgba(0,229,160,0.15)',  'CLUTCH': 'rgba(245,166,35,0.15)',
    'PATIENT': 'rgba(0,212,255,0.15)', 'HIGH-K': 'rgba(255,59,48,0.15)',
    'FREE-OUT':'rgba(0,229,160,0.15)', 'WEAK-CONTACT':'rgba(0,229,160,0.15)',
    'CHASE':   'rgba(0,229,160,0.15)',
  }
  const tagBorder = {
    'CONTACT': 'rgba(0,212,255,0.35)',  'POWER': 'rgba(245,166,35,0.35)',
    'SPEED':   'rgba(0,229,160,0.35)',  'CLUTCH': 'rgba(245,166,35,0.35)',
    'PATIENT': 'rgba(0,212,255,0.35)', 'HIGH-K': 'rgba(255,59,48,0.35)',
    'FREE-OUT':'rgba(0,229,160,0.35)', 'WEAK-CONTACT':'rgba(0,229,160,0.35)',
    'CHASE':   'rgba(0,229,160,0.35)',
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
      zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center',
      padding:16, overflowY:'auto'
    }}>
      <div style={{
        background:'#0a1628', border:`1px solid ${border}`, borderRadius:12,
        width:'100%', maxWidth:680, maxHeight:'90vh', overflowY:'auto',
        display:'flex', flexDirection:'column',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding:'20px 24px 16px', borderBottom:`1px solid ${border}`,
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          position:'sticky', top:0, background:'#0a1628', zIndex:10,
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <span style={{ fontSize:18 }}>🛩️</span>
              <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:20, fontWeight:700, color:gold, letterSpacing:2 }}>
                F-16 SCOUTING INTEL
              </div>
            </div>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:dim, letterSpacing:2 }}>
              {opponentName.toUpperCase()}
            </div>
            {boxScores.length > 0 && (
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:green, marginTop:4 }}>
                ● {boxScores.length} GAME{boxScores.length > 1 ? 'S' : ''} ANALYZED
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:`1px solid ${border}`, borderRadius:6,
            color:dim, cursor:'pointer', padding:'6px 12px', fontSize:11,
            fontFamily:"'Share Tech Mono',monospace",
          }}>✕ CLOSE</button>
        </div>

        <div style={{ padding:'16px 24px', display:'flex', flexDirection:'column', gap:16 }}>

          {/* ── Upload Section ── */}
          <div style={{
            background:'rgba(0,212,255,0.04)', border:`1px solid rgba(0,212,255,0.15)`,
            borderRadius:8, padding:16,
          }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:cyan, letterSpacing:2, marginBottom:10 }}>
              📸 UPLOAD BOX SCORE SCREENSHOTS
            </div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:dim, marginBottom:12, lineHeight:1.5 }}>
              Upload GameChanger box score screenshots from any game your opponent has played.
              More screenshots = smarter scouting report. Accepts multiple files at once.
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display:'none' }}
              onChange={handleFilesSelected}
            />

            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  padding:'10px 20px', borderRadius:6, cursor: uploading ? 'not-allowed' : 'pointer',
                  background: uploading ? 'rgba(0,212,255,0.05)' : 'rgba(0,212,255,0.1)',
                  border:`1px solid rgba(0,212,255,${uploading ? '0.2' : '0.4'})`,
                  color: uploading ? dim : cyan,
                  fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
                }}
              >
                {uploading ? '⟳ PROCESSING...' : '📸 CHOOSE SCREENSHOTS'}
              </button>

              {boxScores.length > 0 && (
                <button
                  onClick={handleGenerateReport}
                  disabled={generating}
                  style={{
                    padding:'10px 20px', borderRadius:6, cursor: generating ? 'not-allowed' : 'pointer',
                    background: generating ? 'rgba(245,166,35,0.05)' : 'rgba(245,166,35,0.1)',
                    border:`1px solid rgba(245,166,35,${generating ? '0.2' : '0.5'})`,
                    color: generating ? dim : gold,
                    fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
                  }}
                >
                  {generating ? '⟳ GENERATING...' : '⚡ REGENERATE REPORT'}
                </button>
              )}
            </div>

            {uploadProgress && (
              <div style={{ marginTop:10, fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:cyan }}>
                {uploadProgress}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              background:'rgba(255,59,48,0.1)', border:`1px solid rgba(255,59,48,0.3)`,
              borderRadius:6, padding:'10px 14px',
              fontFamily:"'DM Sans',sans-serif", fontSize:12, color:red,
            }}>
              {error}
            </div>
          )}

          {/* ── Pending Confirmation Panel ── */}
          {pendingBoxScores.length > 0 && (
            <div style={{
              background:'rgba(245,166,35,0.06)', border:`1px solid rgba(245,166,35,0.4)`,
              borderRadius:8, padding:16,
            }}>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:gold, letterSpacing:2, marginBottom:4 }}>
                ⚠ VERIFY TEAMS BEFORE SAVING
              </div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:dim, marginBottom:12 }}>
                Confirm Claude extracted the correct team. Uncheck any that look wrong.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {pendingBoxScores.map((item, i) => {
                  const detected = item.extracted.team_name || 'Unknown team'
                  const vs       = item.extracted.game_vs   || '?'
                  const batters  = item.extracted.batters?.length || 0
                  const isCorrect = detected.toLowerCase().includes(opponentName.toLowerCase().split(' ')[0])
                    || opponentName.toLowerCase().includes(detected.toLowerCase().split(' ')[0])
                  return (
                    <div key={i} style={{
                      background: item.confirmed ? 'rgba(0,229,160,0.05)' : 'rgba(255,59,48,0.05)',
                      border:`1px solid ${item.confirmed ? 'rgba(0,229,160,0.2)' : 'rgba(255,59,48,0.2)'}`,
                      borderRadius:6, padding:'10px 12px',
                      display:'flex', alignItems:'flex-start', gap:10,
                    }}>
                      <input
                        type="checkbox"
                        checked={item.confirmed}
                        onChange={e => setPendingBoxScores(prev => prev.map((p, idx) =>
                          idx === i ? { ...p, confirmed: e.target.checked } : p
                        ))}
                        style={{ marginTop:2, accentColor: 'var(--green)', width:16, height:16, cursor:'pointer' }}
                      />
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                          <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:14,
                            color: isCorrect ? green : gold }}>
                            {detected}
                          </div>
                          {!isCorrect && (
                            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:gold,
                              padding:'1px 6px', borderRadius:3, border:'1px solid rgba(245,166,35,0.4)' }}>
                              ⚠ CHECK NAME
                            </div>
                          )}
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:dim }}>
                          vs {vs} · {batters} batters extracted
                          {item.extracted.game_date ? ` · ${item.extracted.game_date}` : ''}
                        </div>
                        {!isCorrect && (
                          <div style={{ marginTop:6, fontFamily:"'DM Sans',sans-serif", fontSize:11, color:gold }}>
                            Expected: <strong>{opponentName}</strong> — uncheck if this is the wrong team's data
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button
                  onClick={handleConfirmSave}
                  disabled={uploading}
                  style={{
                    flex:1, padding:'10px', borderRadius:6, cursor:'pointer',
                    background:'rgba(0,229,160,0.1)', border:'1px solid rgba(0,229,160,0.4)',
                    color:green, fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
                  }}
                >
                  ✓ SAVE {pendingBoxScores.filter(p=>p.confirmed).length} CONFIRMED GAME{pendingBoxScores.filter(p=>p.confirmed).length !== 1 ? 'S' : ''}
                </button>
                <button
                  onClick={() => setPendingBoxScores([])}
                  style={{
                    padding:'10px 16px', borderRadius:6, cursor:'pointer',
                    background:'transparent', border:`1px solid ${border}`,
                    color:dim, fontFamily:"'Share Tech Mono',monospace", fontSize:10,
                  }}
                >CANCEL</button>
              </div>
            </div>
          )}

          {/* ── View Toggle ── */}
          {(report || boxScores.length > 0) && (
            <div style={{ display:'flex', gap:8 }}>
              {['report', 'games'].map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding:'6px 16px', borderRadius:4, cursor:'pointer',
                  background: view === v ? 'rgba(245,166,35,0.15)' : 'transparent',
                  border:`1px solid ${view === v ? 'rgba(245,166,35,0.5)' : border}`,
                  color: view === v ? gold : dim,
                  fontFamily:"'Share Tech Mono',monospace", fontSize:9, letterSpacing:1,
                }}>
                  {v === 'report' ? '⚡ INTEL REPORT' : `📋 GAMES (${boxScores.length})`}
                </button>
              ))}
            </div>
          )}

          {/* ── No Data State ── */}
          {boxScores.length === 0 && !uploading && (
            <div style={{
              textAlign:'center', padding:'40px 20px',
              fontFamily:"'Share Tech Mono',monospace", color:dim, fontSize:11,
            }}>
              <div style={{ fontSize:32, marginBottom:12 }}>🛩️</div>
              <div style={{ letterSpacing:2, marginBottom:8 }}>NO INTEL ON FILE</div>
              <div style={{ fontSize:9, lineHeight:1.8 }}>
                Upload GameChanger box score screenshots<br/>
                from any games {opponentName} has played.<br/>
                Find them on GameChanger public pages,<br/>
                tournament brackets, or team connections.
              </div>
            </div>
          )}

          {/* ── Generating State ── */}
          {generating && (
            <div style={{
              textAlign:'center', padding:'30px',
              fontFamily:"'Share Tech Mono',monospace", color:gold, fontSize:11,
            }}>
              <div style={{ fontSize:24, marginBottom:10 }}>⚡</div>
              <div style={{ letterSpacing:2 }}>CLAUDE IS ANALYZING {boxScores.length} GAMES...</div>
              <div style={{ fontSize:9, color:dim, marginTop:6 }}>Building your scouting intelligence report</div>
            </div>
          )}

          {/* ── Intel Report View ── */}
          {view === 'report' && report && !generating && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Danger Zone */}
              {report.danger_zone?.length > 0 && (
                <div>
                  <div style={{
                    fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:red,
                    letterSpacing:3, marginBottom:10,
                    display:'flex', alignItems:'center', gap:8,
                  }}>
                    🎯 DANGER ZONE — PROTECT AGAINST
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {report.danger_zone.map((p, i) => (
                      <div key={i} style={{
                        background:'rgba(255,59,48,0.05)', border:`1px solid rgba(255,59,48,0.2)`,
                        borderRadius:8, padding:'12px 14px',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:15, color:primary }}>
                              {p.jersey} {p.name}
                            </div>
                            {p.position && (
                              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:dim }}>
                                {p.position}
                              </div>
                            )}
                          </div>
                          <div style={{
                            fontFamily:"'Share Tech Mono',monospace", fontSize:8,
                            color: threatColor(p.threat_level),
                            padding:'2px 8px', borderRadius:3,
                            border:`1px solid ${threatColor(p.threat_level)}`,
                            opacity:0.8,
                          }}>
                            {p.threat_level}
                          </div>
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:gold, marginBottom:6 }}>
                          {p.stats}
                        </div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:primary, lineHeight:1.5, marginBottom:8 }}>
                          {p.insight}
                        </div>
                        {p.tags?.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                            {p.tags.map(tag => (
                              <span key={tag} style={{
                                padding:'2px 8px', borderRadius:3, fontSize:9,
                                fontFamily:"'Share Tech Mono',monospace",
                                background: tagColors[tag] || 'rgba(255,255,255,0.05)',
                                border:`1px solid ${tagBorder[tag] || border}`,
                                color: primary,
                              }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attack Zone */}
              {report.attack_zone?.length > 0 && (
                <div>
                  <div style={{
                    fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:green,
                    letterSpacing:3, marginBottom:10,
                  }}>
                    ⚡ ATTACK ZONE — EASY OUTS
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {report.attack_zone.map((p, i) => (
                      <div key={i} style={{
                        background:'rgba(0,229,160,0.04)', border:`1px solid rgba(0,229,160,0.15)`,
                        borderRadius:8, padding:'12px 14px',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                          <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:15, color:primary }}>
                            {p.jersey} {p.name}
                          </div>
                          {p.position && (
                            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:dim }}>
                              {p.position}
                            </div>
                          )}
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:green, marginBottom:6 }}>
                          {p.stats}
                        </div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:primary, lineHeight:1.5, marginBottom:8 }}>
                          {p.insight}
                        </div>
                        {p.tags?.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                            {p.tags.map(tag => (
                              <span key={tag} style={{
                                padding:'2px 8px', borderRadius:3, fontSize:9,
                                fontFamily:"'Share Tech Mono',monospace",
                                background: tagColors[tag] || 'rgba(255,255,255,0.05)',
                                border:`1px solid ${tagBorder[tag] || border}`,
                                color: primary,
                              }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pitcher Intel */}
              {report.pitcher_intel?.length > 0 && (
                <div>
                  <div style={{
                    fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:cyan,
                    letterSpacing:3, marginBottom:10,
                  }}>
                    ⚾ PITCHER INTEL
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {report.pitcher_intel.map((p, i) => (
                      <div key={i} style={{
                        background:'rgba(0,212,255,0.04)', border:`1px solid rgba(0,212,255,0.15)`,
                        borderRadius:8, padding:'12px 14px',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                          <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:15, color:primary }}>
                            {p.jersey} {p.name}
                          </div>
                          <div style={{
                            fontFamily:"'Share Tech Mono',monospace", fontSize:8,
                            color: threatColor(p.threat),
                            padding:'2px 8px', borderRadius:3,
                            border:`1px solid ${threatColor(p.threat)}`,
                            opacity:0.8,
                          }}>
                            {p.threat} THREAT
                          </div>
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:cyan, marginBottom:6 }}>
                          {p.stats}
                        </div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:primary, lineHeight:1.5 }}>
                          {p.insight}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Tendencies */}
              {report.team_tendencies && (
                <div style={{
                  background:'rgba(245,166,35,0.05)', border:`1px solid rgba(245,166,35,0.2)`,
                  borderRadius:8, padding:'12px 14px',
                }}>
                  <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:gold, letterSpacing:2, marginBottom:8 }}>
                    📊 TEAM TENDENCIES
                  </div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:primary, lineHeight:1.6 }}>
                    {report.team_tendencies}
                  </div>
                </div>
              )}

              {/* Game Plan */}
              {report.game_plan && (
                <div style={{
                  background:'rgba(245,166,35,0.08)', border:`1px solid rgba(245,166,35,0.35)`,
                  borderRadius:8, padding:'14px 16px',
                }}>
                  <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:gold, letterSpacing:2, marginBottom:10 }}>
                    🎯 RECOMMENDED GAME PLAN
                  </div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:primary, lineHeight:1.7 }}>
                    {report.game_plan}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Games List View ── */}
          {view === 'games' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {boxScores.length === 0 ? (
                <div style={{ textAlign:'center', padding:20, color:dim, fontFamily:"'Share Tech Mono',monospace", fontSize:10 }}>
                  NO GAMES UPLOADED YET
                </div>
              ) : boxScores.map((game, i) => {
                const batters = game.batters || []
                const hits = batters.reduce((s, b) => s + (Number(b.h) || 0), 0)
                const runs = batters.reduce((s, b) => s + (Number(b.r) || 0), 0)
                return (
                  <div key={game.id} style={{
                    background:'rgba(255,255,255,0.02)', border:`1px solid ${border}`,
                    borderRadius:8, padding:'12px 14px',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}>
                    <div>
                      <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:600, fontSize:13, color:primary, marginBottom:2 }}>
                        {game.game_vs ? `vs ${game.game_vs}` : `Game ${i + 1}`}
                        {game.game_date ? ` — ${game.game_date}` : ''}
                      </div>
                      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:dim }}>
                        {batters.length} batters · {hits}H · {runs}R
                        {game.pitchers?.length > 0 && ` · ${game.pitchers.length} pitcher(s)`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(game.id)}
                      style={{
                        background:'transparent', border:`1px solid rgba(255,59,48,0.3)`,
                        borderRadius:4, color:'rgba(255,59,48,0.6)', cursor:'pointer',
                        padding:'4px 10px', fontSize:10,
                        fontFamily:"'Share Tech Mono',monospace",
                      }}
                    >✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
