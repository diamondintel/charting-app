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
            text: `This is a GameChanger softball box score screenshot. Extract all data.

Return ONLY a JSON object with this exact structure:
{
  "team_name": "team name from box score header",
  "game_vs": "opposing team name if visible",
  "game_date": "date if visible (YYYY-MM-DD format)",
  "final_score": "score if visible e.g. 3-1",
  "batters": [
    {
      "name": "player name (clean up truncation like D Ferrar...23 → D Ferrara)",
      "jersey": "jersey number as string",
      "position": "position abbreviation",
      "ab": 0, "r": 0, "h": 0, "rbi": 0, "bb": 0, "so": 0
    }
  ],
  "pitchers": [
    {
      "name": "pitcher name",
      "jersey": "jersey number",
      "ip": "5.0", "h": 0, "r": 0, "er": 0, "bb": 0, "so": 0,
      "result": "W or L or blank"
    }
  ]
}

Important:
- Try to clean up truncated names (D Ferrar...23 → D Ferrara, M Kalei...#99 → M Kaleialoha or similar)
- Include ALL batters shown
- If a field is not visible, use 0 for numbers or empty string for text
- Return ONLY the JSON, no other text`
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

// ── Generate AI scouting report from all box scores ──────────────────────────
async function generateScoutingReport(opponentName, boxScores) {
  // Aggregate stats across all games
  const batterMap = {}
  const pitcherMap = {}

  for (const game of boxScores) {
    const batters  = game.batters  || []
    const pitchers = game.pitchers || []

    for (const b of batters) {
      const key = b.name?.trim().toLowerCase()
      if (!key || key === 'team' || key === 'totals') continue
      if (!batterMap[key]) {
        batterMap[key] = { name: b.name, jersey: b.jersey, position: b.position, games: 0, ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 }
      }
      batterMap[key].games += 1
      batterMap[key].ab  += Number(b.ab)  || 0
      batterMap[key].r   += Number(b.r)   || 0
      batterMap[key].h   += Number(b.h)   || 0
      batterMap[key].rbi += Number(b.rbi) || 0
      batterMap[key].bb  += Number(b.bb)  || 0
      batterMap[key].so  += Number(b.so)  || 0
    }

    for (const p of pitchers) {
      const key = p.name?.trim().toLowerCase()
      if (!key) continue
      if (!pitcherMap[key]) {
        pitcherMap[key] = { name: p.name, jersey: p.jersey, games: 0, ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0 }
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

  const batterSummary = Object.values(batterMap).map(b => {
    const avg = b.ab > 0 ? (b.h / b.ab).toFixed(3) : '.000'
    const kRate = b.ab > 0 ? Math.round((b.so / b.ab) * 100) : 0
    return `${b.name} ${b.jersey ? '#'+b.jersey : ''} ${b.position || ''}: ${b.games}G, ${b.ab}AB, ${b.h}H, AVG ${avg}, ${b.rbi}RBI, ${b.bb}BB, ${b.so}K (K-rate ${kRate}%)`
  }).join('\n')

  const pitcherSummary = Object.values(pitcherMap).map(p => {
    const era = p.ip > 0 ? ((p.er / p.ip) * 7).toFixed(2) : '-'
    const hPer = p.ip > 0 ? (p.h / p.ip).toFixed(1) : '-'
    return `${p.name} ${p.jersey ? '#'+p.jersey : ''}: ${p.games}G, ${p.ip.toFixed(1)}IP, ${p.h}H, ERA ${era}, ${p.so}K, ${p.bb}BB, ${hPer}H/IP`
  }).join('\n')

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are an elite softball pitching coach analyzing opponent scouting data for ${opponentName}.

AGGREGATED STATS FROM ${boxScores.length} GAMES:

BATTERS:
${batterSummary}

PITCHERS:
${pitcherSummary}

Generate a pre-game scouting intelligence report. Return ONLY a JSON object:
{
  "danger_zone": [
    {
      "name": "player name",
      "jersey": "#N",
      "position": "SS",
      "threat_level": "HIGH or MEDIUM",
      "stats": "brief stat line e.g. .420 avg, 3 RBI in 4 games",
      "insight": "1-2 sentence tactical insight — how to approach this batter",
      "tags": ["CONTACT", "POWER", "SPEED", "CLUTCH", "PATIENT"]
    }
  ],
  "attack_zone": [
    {
      "name": "player name",
      "jersey": "#N", 
      "position": "CF",
      "stats": "brief stat line",
      "insight": "why she is an easy out and how to exploit",
      "tags": ["HIGH-K", "FREE-OUT", "WEAK-CONTACT", "CHASE"]
    }
  ],
  "pitcher_intel": [
    {
      "name": "pitcher name",
      "jersey": "#N",
      "stats": "ERA, H/IP, K rate",
      "insight": "is she hittable? what approach to take vs her?",
      "threat": "HIGH or MEDIUM or LOW"
    }
  ],
  "team_tendencies": "2-3 sentences on overall team offensive approach",
  "game_plan": "3-4 sentence recommended game plan for today including which spots in the order to attack and which to protect against"
}

Be specific and tactical. Use softball-specific language coaches understand.
Only include players with meaningful data (2+ AB).
Danger zone = .300+ avg OR multiple RBI OR low K rate.
Attack zone = .150 or below avg OR high K rate OR 0 hits in multiple games.`
      }]
    })
  })

  if (!response.ok) throw new Error(`Report generation failed: ${response.status}`)
  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OpponentScouting({ teamId, opponentName, onClose }) {
  const [boxScores, setBoxScores]       = useState([])
  const [report, setReport]             = useState(null)
  const [uploading, setUploading]       = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError]               = useState(null)
  const [view, setView]                 = useState('report') // 'report' | 'games'
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

    let successCount = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress(`Processing ${i + 1} of ${files.length}: ${file.name}`)
      try {
        const base64  = await compressImage(file)
        const extracted = await extractBoxScore(base64)
        await saveScoutingBoxScore(teamId, opponentName, {
          game_date:     extracted.game_date || null,
          game_vs:       extracted.game_vs   || null,
          raw_extracted: extracted,
          batters:       extracted.batters   || [],
          pitchers:      extracted.pitchers  || [],
        })
        successCount++
      } catch(e) {
        console.error(`Failed to process ${file.name}:`, e)
      }
    }

    setUploadProgress('')
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (successCount > 0) {
      await load()
      // Auto-generate report after upload
      await handleGenerateReport()
    } else {
      setError('No box scores could be processed. Try clearer screenshots.')
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
