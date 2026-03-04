import { useState, useEffect, useRef } from 'react'
import {
  getSavedOpponentTeams, getOpponentLineup, upsertOpponentPlayer, clearOpponentLineup,
  saveScoutingBoxScore, getScoutingBoxScores, saveScoutingReport, getScoutingReport
} from '../lib/db'

const gold   = 'var(--gold)'
const cyan   = 'var(--cyan)'
const green  = 'var(--green)'
const red    = 'var(--red)'
const border = 'var(--border)'
const dim    = 'var(--text-dim)'
const panel  = 'var(--panel)'
const primary = 'var(--text-primary)'

// ── Image compression ─────────────────────────────────────────────────────────
async function compressImage(file) {
  return new Promise((res, rej) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxW   = 1200
      const scale  = Math.min(1, maxW / img.width)
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

// ── OCR lineup scan (reusing F-02 pipeline) ───────────────────────────────────
async function ocrLineup(base64) {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: `Extract the softball lineup from this image. Return ONLY a JSON array:
[{"order":1,"jersey":"12","name":"Player Name","position":"SS","batter_type":"R"}]

CRITICAL — GameChanger player rows look like: "Carter Grigg 2032 #8 (SS)"
- jersey: the number that comes AFTER the # symbol. Example: "Carter Grigg 2032 #8 (SS)" → jersey is "8". NEVER use a 4-digit birth year as jersey.
- name: ONLY the text BEFORE the # symbol, stripped of any 4-digit year. Example: "Carter Grigg 2032 #8 (SS)" → name is "Carter Grigg"
- order: batting order position 1-9 (or 1-10 for DH)
- position: P, C, 1B, 2B, 3B, SS, LF, CF, RF, DP, FLEX — use the position shown in parentheses if visible
- batter_type: R, L, or S (switch) — guess R if unknown
Return ONLY the JSON array, no other text.` }
        ]
      }]
    })
  })
  if (!response.ok) throw new Error(`OCR failed: ${response.status}`)
  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// ── Fuzzy name match — returns best roster match for an extracted player ───────
function fuzzyMatchPlayer(extracted, knownRoster) {
  if (!knownRoster || knownRoster.length === 0) return null
  const extJersey = (extracted.jersey || '').toString().trim()
  const extName   = normalizeName(extracted.name || '').toLowerCase()
  const extLast   = extName.split(' ').pop()

  // Pass 1: jersey + last name both match → high confidence
  for (const p of knownRoster) {
    const kJersey = (p.jersey || '').toString().trim()
    const kLast   = (p.name || '').toLowerCase().split(' ').pop()
    if (kJersey === extJersey && kLast === extLast) return { player: p, flag: false }
  }

  // Pass 2: last name matches, jersey differs → likely number change
  for (const p of knownRoster) {
    const kLast = (p.name || '').toLowerCase().split(' ').pop()
    if (kLast === extLast && kLast.length >= 4) return { player: p, flag: true }
  }

  // Pass 3: jersey matches, name looks different → possible typo/truncation
  for (const p of knownRoster) {
    const kJersey = (p.jersey || '').toString().trim()
    if (kJersey === extJersey && kJersey !== '') return { player: p, flag: true }
  }

  return null // no match — new player
}

// ── Extract box score ─────────────────────────────────────────────────────────
async function extractBoxScore(base64, opponentName) {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: `This is a GameChanger softball box score. I need stats for the team matching: "${opponentName}".

GameChanger shows TWO teams — LEFT panel and RIGHT panel, each with their own bold header.

TEAM IDENTIFICATION — CRITICAL:
- Read BOTH bold section headers (left panel AND right panel)
- Extract the section whose header most closely matches: "${opponentName}"
- The team may appear on either the left OR right side depending on home/away
- Set "game_vs" to the OTHER team's name (the panel you did NOT extract)
- If unsure which side, pick the closest name match

NAME EXTRACTION — COPY EXACTLY AS SHOWN:
- Copy the player name EXACTLY as it appears in the lineup column — do not rewrite, guess, or "clean up"
- GameChanger names look like: "Carter Grigg 2032 #8 (SS)" or "Mary Ingrassia #50 (LF)" or "Alasia Lai 2030 #9"
- Copy the FULL raw text from the name cell verbatim — our system will clean it automatically
- NEVER substitute a different name, spelling, or guess at a truncated first name
- If text is cut off, copy whatever IS visible including any "..." characters

Return ONLY this JSON, no other text:
{
  "team_name": "exact team name from bold section header",
  "game_vs": "the OTHER team in the score header (not in the lineup)",
  "game_date": "YYYY-MM-DD if visible, empty string if not",
  "batters": [{"name":"full raw name as shown","jersey":"number only","position":"SS","ab":0,"r":0,"h":0,"rbi":0,"bb":0,"so":0}],
  "pitchers": [{"name":"full raw name as shown","jersey":"number only","ip":"0.0","h":0,"r":0,"er":0,"bb":0,"so":0,"result":"W or L or empty"}]
}
Exclude TEAM totals row. Return ONLY the JSON.` }
        ]
      }]
    })
  })
  if (!response.ok) throw new Error(`Box score extraction failed: ${response.status}`)
  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// ── Normalize player name — strips birth years and position suffixes ─────────
// GameChanger format: "Firstname Lastname YYYY #Jersey (Position)"
// Name = everything BEFORE the first #, stripped of birth year
// Jersey = digits immediately after #
function normalizeName(raw) {
  if (!raw) return ''
  // Take only the part before the first # — that contains name + possibly birth year
  const beforeHash = raw.split('#')[0]
  return beforeHash
    .replace(/(19|20)\d{2}/g, ' ')  // strip birth years
    .replace(/\s*\([^)]+\)\s*/g, ' ')     // strip (SS) etc
    .replace(/\s+/g, ' ')
    .trim()
}
function extractJersey(raw, fallback) {
  // Always prefer extracting from the raw name string after # 
  const fromName = (raw || '').match(/#(\d+)/)
  if (fromName) return fromName[1]
  // Fall back to the jersey field only if it looks like a real jersey (1-3 digits)
  if (fallback && /^\d{1,3}$/.test(fallback)) return fallback
  return ''
}

// ── Generate scouting report ──────────────────────────────────────────────────
async function generateScoutingReport(opponentName, boxScores) {
  const batterMap  = {}
  const pitcherMap = {}

  for (const game of boxScores) {
    for (const b of (game.batters || [])) {
      const rawName = b.name || ''
      const key     = normalizeName(rawName).toLowerCase()
      if (!key || key === 'team' || key === 'totals') continue
      if (!batterMap[key]) batterMap[key] = {
        name: normalizeName(rawName), jersey: extractJersey(rawName, b.jersey),
        position: b.position || '', games: 0, ab: 0, h: 0, rbi: 0, bb: 0, so: 0
      }
      batterMap[key].games++
      batterMap[key].ab  += Number(b.ab)  || 0
      batterMap[key].h   += Number(b.h)   || 0
      batterMap[key].rbi += Number(b.rbi) || 0
      batterMap[key].bb  += Number(b.bb)  || 0
      batterMap[key].so  += Number(b.so)  || 0
      if (!batterMap[key].jersey) batterMap[key].jersey = extractJersey(rawName, b.jersey)
    }
    for (const p of (game.pitchers || [])) {
      const rawName = p.name || ''
      const key     = normalizeName(rawName).toLowerCase()
      if (!key) continue
      if (!pitcherMap[key]) pitcherMap[key] = {
        name: normalizeName(rawName), jersey: extractJersey(rawName, p.jersey),
        games: 0, ip: 0, h: 0, er: 0, bb: 0, so: 0
      }
      pitcherMap[key].games++
      pitcherMap[key].ip += parseFloat(p.ip) || 0
      pitcherMap[key].h  += Number(p.h)  || 0
      pitcherMap[key].er += Number(p.er) || 0
      pitcherMap[key].bb += Number(p.bb) || 0
      pitcherMap[key].so += Number(p.so) || 0
    }
  }

  const batters = Object.values(batterMap)
    .filter(b => b.ab >= 2)
    .sort((a, b) => b.ab - a.ab)
    .map(b => ({
      name: b.name, jersey: b.jersey ? `#${b.jersey}` : '', position: b.position,
      games: b.games, ab: b.ab, h: b.h,
      avg: b.ab > 0 ? (b.h / b.ab).toFixed(3) : '.000',
      rbi: b.rbi, bb: b.bb, so: b.so,
      k_rate: b.ab > 0 ? Math.round((b.so / b.ab) * 100) : 0,
    }))

  const pitchers = Object.values(pitcherMap)
    .filter(p => p.ip >= 1)
    .map(p => ({
      name: p.name, jersey: p.jersey ? `#${p.jersey}` : '',
      games: p.games, ip: p.ip.toFixed(1), h: p.h, er: p.er, so: p.so, bb: p.bb,
      era: p.ip > 0 ? ((p.er / p.ip) * 7).toFixed(2) : '-',
      h_per_ip: p.ip > 0 ? (p.h / p.ip).toFixed(1) : '-',
    }))

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3500,
      messages: [{
        role: 'user',
        content: `Elite softball pitching coach. Generate scouting report for ${opponentName} (${boxScores.length} games).

CRITICAL: Use ONLY exact names from the data. Do NOT invent or alter any player names.

BATTERS: ${JSON.stringify(batters)}
PITCHERS: ${JSON.stringify(pitchers)}

Return ONLY JSON:
{
  "danger_zone": [{"name":"exact name from data","jersey":"from data","position":"from data","threat_level":"HIGH or MEDIUM","stats":"","insight":"","tags":[]}],
  "attack_zone": [{"name":"exact name","jersey":"from data","position":"from data","stats":"","insight":"","tags":[]}],
  "pitcher_intel": [{"name":"exact name","jersey":"from data","stats":"","insight":"","threat":"HIGH or MEDIUM or LOW"}],
  "team_tendencies": "",
  "game_plan": ""
}
Danger = AVG .280+ or multi-RBI or K-rate under 20%. Attack = AVG .150- or K-rate 30%+. Only players with 2+ AB.`
      }]
    })
  })
  if (!response.ok) throw new Error(`Report failed: ${response.status}`)
  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function PreGamePrep({ teamId, onClose }) {
  const [step, setStep]                 = useState('select')  // select | prep
  const [opponentInput, setOpponentInput] = useState('')
  const [savedOpponents, setSavedOpponents] = useState([])
  const [activeOpponent, setActiveOpponent] = useState('')

  // Roster state
  const [roster, setRoster]             = useState([])
  const [rosterSaved, setRosterSaved]   = useState(false)
  const [scanningLineup, setScanningLineup] = useState(false)

  // Scouting state
  const [boxScores, setBoxScores]       = useState([])
  const [report, setReport]             = useState(null)
  const [uploadingBoxScore, setUploadingBoxScore] = useState(false)
  const [generatingReport, setGeneratingReport]   = useState(false)
  const [uploadProgress, setUploadProgress]       = useState('')
  const [pendingExtracted, setPendingExtracted] = useState(null)
  const [confirmRows, setConfirmRows]           = useState([])
  const [confirmingRoster, setConfirmingRoster] = useState(false)
  const [pendingFiles, setPendingFiles]         = useState([])

  // UI
  const [activeTab, setActiveTab]       = useState('roster')  // roster | scouting
  const [error, setError]               = useState(null)
  const [successMsg, setSuccessMsg]     = useState('')

  const lineupFileRef   = useRef()
  const scoutingFileRef = useRef()

  useEffect(() => {
    getSavedOpponentTeams(teamId).then(setSavedOpponents).catch(console.error)
  }, [teamId])

  useEffect(() => {
    if (!activeOpponent) return
    loadOpponentData(activeOpponent)
  }, [activeOpponent])

  async function loadOpponentData(name) {
    try {
      const [players, scores, rep] = await Promise.all([
        getOpponentLineup(teamId, name),
        getScoutingBoxScores(teamId, name),
        getScoutingReport(teamId, name),
      ])
      setRoster(players.length > 0 ? players : buildEmptyRoster())
      setBoxScores(scores)
      setReport(rep?.report || null)
    } catch(e) { setError(e.message) }
  }

  function buildEmptyRoster() {
    return Array.from({ length: 9 }, (_, i) => ({
      lineup_order: i + 1, jersey: '', name: '', position: '', batter_type: 'R',
      team_side: 'opponent', isNew: true
    }))
  }

  function handleSelectOpponent(name) {
    setActiveOpponent(name)
    setStep('prep')
    setError(null)
  }

  function handleNewOpponent() {
    const name = opponentInput.trim()
    if (!name) return
    setActiveOpponent(name)
    setStep('prep')
    setError(null)
  }

  // ── Roster: scan lineup card ────────────────────────────────────────────────
  async function handleLineupScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanningLineup(true)
    setError(null)
    try {
      const base64  = await compressImage(file)
      const players = await ocrLineup(base64)
      const mapped  = players.map((p, i) => {
        // Run through same normalization as box score extraction
        const rawName = p.name || ''
        return {
          lineup_order: p.order || i + 1,
          jersey:       extractJersey(rawName, p.jersey),
          name:         normalizeName(rawName) || rawName,
          position:     p.position || '',
          batter_type:  p.batter_type || 'R',
          team_side:    'opponent',
          isNew:        true,
        }
      })
      setRoster(mapped)
      flash('Lineup scanned! Review names then save.')
    } catch(e) {
      setError(`Scan failed: ${e.message}`)
    } finally {
      setScanningLineup(false)
      if (lineupFileRef.current) lineupFileRef.current.value = ''
    }
  }

  // ── Roster: manual edit ─────────────────────────────────────────────────────
  function updateRow(i, field, value) {
    setRoster(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRoster(prev => [...prev, {
      lineup_order: prev.length + 1, jersey: '', name: '', position: '', batter_type: 'R',
      team_side: 'opponent', isNew: true
    }])
  }

  function removeRow(i) {
    setRoster(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, lineup_order: idx + 1 })))
  }

  // ── Roster: save ───────────────────────────────────────────────────────────
  async function handleSaveRoster() {
    // Strictly filter — must be a real object with a non-empty name string
    const filled = (roster || []).filter(r =>
      r != null &&
      typeof r === 'object' &&
      r.name != null &&
      String(r.name).trim().length > 0
    )
    if (!filled.length) { setError('Add at least one player name before saving.'); return }
    setError(null)
    try {
      await clearOpponentLineup(teamId, activeOpponent)
      for (let i = 0; i < filled.length; i++) {
        const p = filled[i]
        const safeName = String(p.name).trim()
        if (!safeName) { console.warn('Skipping blank player at index', i); continue }
        await upsertOpponentPlayer(teamId, activeOpponent, {
          lineup_order:  p.lineup_order || i + 1,
          jersey:        p.jersey || '',
          name:          safeName,
          position:      p.position || '',
          batter_type:   p.batter_type || 'R',
          team_side:     'opponent',
        })
      }
      setRosterSaved(true)
      setTimeout(() => setRosterSaved(false), 3000)
      getSavedOpponentTeams(teamId).then(setSavedOpponents).catch(console.error)
      flash(`✓ Roster saved for ${activeOpponent}`)
    } catch(e) {
      console.error('handleSaveRoster error:', e.message)
      console.error('handleSaveRoster stack:', e.stack)
      console.error('roster state was:', JSON.stringify(roster))
      setError(`Save failed: ${e.message} — see console`)
    }
  }

  // ── Scouting: upload box scores — roster confirmation flow ──────────────────
  async function handleBoxScoreUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    if (scoutingFileRef.current) scoutingFileRef.current.value = ''
    setActiveTab('scouting')
    await processNextFile(files, 0)
  }

  async function processNextFile(files, index) {
    if (index >= files.length) {
      const updated = await getScoutingBoxScores(teamId, activeOpponent)
      setBoxScores(updated)
      setUploadingBoxScore(false)
      setUploadProgress('')
      if (updated.length > 0) {
        flash(`${files.length} box score${files.length > 1 ? 's' : ''} uploaded. Generating intel report...`)
        await handleGenerateReport(updated)
      }
      return
    }

    setUploadingBoxScore(true)
    setUploadProgress(`Processing ${index + 1} of ${files.length}...`)
    setError(null)

    try {
      const base64    = await compressImage(files[index])
      const extracted = await extractBoxScore(base64, activeOpponent)

      // Always fetch roster fresh from DB — don't rely on state which may be stale
      const freshRoster = await getOpponentLineup(teamId, activeOpponent).catch(() => [])
      const knownPlayers = freshRoster.filter(r => r.name?.trim())

      const rows = (extracted.batters || []).map(b => {
        const rawName  = b.name || ''
        const extNorm  = normalizeName(rawName)
        const jersey   = extractJersey(rawName, b.jersey)
        const match    = fuzzyMatchPlayer({ jersey, name: extNorm }, knownPlayers)
        return {
          jersey,
          extractedName: extNorm,
          confirmedName: match ? match.player.name : '',
          flag:          match ? match.flag : false,
          isNew:         !match,
          stats:         { ab: b.ab, h: b.h, r: b.r, rbi: b.rbi, bb: b.bb, so: b.so },
          position:      b.position || '',
        }
      })

      setPendingExtracted(extracted)
      setConfirmRows(rows)
      setConfirmingRoster(true)
      setPendingFiles({ files, nextIndex: index + 1 })

    } catch(err) {
      console.error(`Failed: ${files[index].name}`, err)
      setError(`Could not process file ${index + 1}: ${err.message}`)
      setUploadingBoxScore(false)
      setUploadProgress('')
    }
  }

  async function handleConfirmRoster() {
    if (!pendingExtracted) return
    setConfirmingRoster(false)
    setError(null)

    try {
      // Build confirmed batters for box score — only rows with a name
      const confirmedBatters = confirmRows
        .filter(row => {
          const n = (row.confirmedName || row.extractedName || '').trim()
          return n.length > 0
        })
        .map(row => ({
          name:     (row.confirmedName || row.extractedName).trim(),
          jersey:   row.jersey || '',
          position: row.position || '',
          ab:  Number(row.stats?.ab)  || 0,
          h:   Number(row.stats?.h)   || 0,
          r:   Number(row.stats?.r)   || 0,
          rbi: Number(row.stats?.rbi) || 0,
          bb:  Number(row.stats?.bb)  || 0,
          so:  Number(row.stats?.so)  || 0,
        }))

      // Build fresh roster purely from confirmed rows — don't merge with state
      // This avoids any stale/undefined entries from placeholder rows
      const freshRosterFromDB = await getOpponentLineup(teamId, activeOpponent).catch(() => [])
      const rosterMap = {}
      for (const p of freshRosterFromDB) {
        if (p?.name?.trim()) rosterMap[p.name.toLowerCase()] = { ...p }
      }

      // Apply confirmed rows — update jersey if changed, add if new
      let order = Object.keys(rosterMap).length
      for (const row of confirmRows) {
        const confirmedName = (row.confirmedName || row.extractedName || '').trim()
        if (!confirmedName) continue
        const key = confirmedName.toLowerCase()
        if (rosterMap[key]) {
          rosterMap[key].jersey = row.jersey || rosterMap[key].jersey
        } else {
          order++
          rosterMap[key] = {
            lineup_order: order, jersey: row.jersey || '',
            name: confirmedName, position: row.position || '',
            batter_type: 'R', team_side: 'opponent',
          }
        }
      }

      // Guard: only keep entries with a valid non-empty name
      const finalRoster = Object.values(rosterMap)
        .filter(p => p && typeof p.name === 'string' && p.name.trim().length > 0)
      setRoster(finalRoster)

      // Save to DB — clear then upsert
      await clearOpponentLineup(teamId, activeOpponent)
      for (const p of finalRoster) {
        await upsertOpponentPlayer(teamId, activeOpponent, {
          lineup_order:  p.lineup_order || 1,
          jersey:        p.jersey || '',
          name:          p.name.trim(),
          position:      p.position || '',
          batter_type:   p.batter_type || 'R',
          team_side:     'opponent',
        })
      }

      // Save box score with confirmed names
      await saveScoutingBoxScore(teamId, activeOpponent, {
        game_date:     pendingExtracted.game_date || null,
        game_vs:       pendingExtracted.game_vs   || null,
        raw_extracted: pendingExtracted,
        batters:       confirmedBatters,
        pitchers:      pendingExtracted.pitchers  || [],
      })

      setPendingExtracted(null)
      setConfirmRows([])

      const { files, nextIndex } = pendingFiles
      await processNextFile(files, nextIndex)

    } catch(err) {
      console.error('handleConfirmRoster crash:', err)
      console.error('Stack:', err.stack)
      setError(`Save failed: ${err.message} | Check console for details`)
      setConfirmingRoster(true)
      setUploadingBoxScore(false)
    }
  }

  function updateConfirmRow(i, value) {
    setConfirmRows(prev => prev.map((r, idx) => idx === i ? { ...r, confirmedName: value } : r))
  }

  async function handleGenerateReport(scores) {
    const data = scores || boxScores
    if (!data.length) { setError('Upload at least one box score first.'); return }
    setGeneratingReport(true)
    try {
      const rep = await generateScoutingReport(activeOpponent, data)
      await saveScoutingReport(teamId, activeOpponent, rep, data.length)
      setReport(rep)
    } catch(e) { setError(`Report failed: ${e.message}`) }
    finally { setGeneratingReport(false) }
  }

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3500)
  }

  const threatColor = t => t === 'HIGH' ? red : t === 'MEDIUM' ? gold : green

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.88)',
      zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center',
      padding:16, overflowY:'auto',
    }}>
      <div style={{
        background:'#0a1628', border:`1px solid ${border}`, borderRadius:12,
        width:'100%', maxWidth:640, maxHeight:'92vh', overflowY:'auto',
        display:'flex', flexDirection:'column', position:'relative',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding:'18px 24px 14px', borderBottom:`1px solid ${border}`,
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          position:'sticky', top:0, background:'#0a1628', zIndex:10,
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:3 }}>
              <span style={{ fontSize:16 }}>🎯</span>
              <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:18, fontWeight:700, color:cyan, letterSpacing:2 }}>
                PRE-GAME PREP
              </div>
            </div>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:dim, letterSpacing:2 }}>
              {step === 'select' ? 'SELECT OR CREATE OPPONENT' : activeOpponent.toUpperCase()}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:`1px solid ${border}`, borderRadius:6,
            color:dim, cursor:'pointer', padding:'5px 12px', fontSize:10,
            fontFamily:"'Share Tech Mono',monospace",
          }}>✕ CLOSE</button>
        </div>

        <div style={{ padding:'16px 24px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP 1: SELECT OPPONENT */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'select' && (
            <>
              {/* New opponent input */}
              <div style={{
                background:'rgba(0,212,255,0.04)', border:`1px solid rgba(0,212,255,0.15)`,
                borderRadius:8, padding:16,
              }}>
                <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:cyan, letterSpacing:2, marginBottom:10 }}>
                  + NEW OPPONENT
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    value={opponentInput}
                    onChange={e => setOpponentInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNewOpponent()}
                    placeholder="e.g. Lakeland Lightning 14U"
                    style={{
                      flex:1, background:'rgba(255,255,255,0.04)',
                      border:`1px solid ${border}`, borderRadius:6,
                      color:primary, padding:'9px 12px', fontSize:13,
                      fontFamily:"'DM Sans',sans-serif", outline:'none',
                    }}
                  />
                  <button
                    onClick={handleNewOpponent}
                    disabled={!opponentInput.trim()}
                    style={{
                      padding:'9px 18px', borderRadius:6, cursor:'pointer',
                      background: opponentInput.trim() ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
                      border:`1px solid rgba(0,212,255,${opponentInput.trim() ? '0.5' : '0.15'})`,
                      color: opponentInput.trim() ? cyan : dim,
                      fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
                    }}
                  >PREP →</button>
                </div>
              </div>

              {/* Saved opponents */}
              {savedOpponents.length > 0 && (
                <div>
                  <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:dim, letterSpacing:2, marginBottom:10 }}>
                    SAVED OPPONENTS — TAP TO PREP
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {savedOpponents.map(name => (
                      <button key={name} onClick={() => handleSelectOpponent(name)} style={{
                        padding:'11px 16px', borderRadius:6, cursor:'pointer', textAlign:'left',
                        background:'rgba(245,166,35,0.05)', border:`1px solid rgba(245,166,35,0.2)`,
                        color:primary, fontFamily:"'DM Sans',sans-serif", fontSize:13,
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        transition:'all 0.12s',
                      }}>
                        <span>{name}</span>
                        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:gold }}>PREP →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {savedOpponents.length === 0 && (
                <div style={{
                  textAlign:'center', padding:'30px 20px',
                  fontFamily:"'Share Tech Mono',monospace", color:dim, fontSize:10,
                  letterSpacing:1,
                }}>
                  NO SAVED OPPONENTS YET<br/>
                  <span style={{ fontSize:8, marginTop:4, display:'block' }}>
                    Type a new opponent name above to start prepping
                  </span>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP 2: PREP TABS */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'prep' && (
            <>
              {/* Back + tabs */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <button onClick={() => { setStep('select'); setActiveOpponent('') }} style={{
                  background:'transparent', border:`1px solid ${border}`, borderRadius:4,
                  color:dim, cursor:'pointer', padding:'5px 10px', fontSize:9,
                  fontFamily:"'Share Tech Mono',monospace",
                }}>← BACK</button>
                {['roster','scouting'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding:'6px 16px', borderRadius:4, cursor:'pointer',
                    background: activeTab === tab ? 'rgba(0,212,255,0.1)' : 'transparent',
                    border:`1px solid ${activeTab === tab ? 'rgba(0,212,255,0.4)' : border}`,
                    color: activeTab === tab ? cyan : dim,
                    fontFamily:"'Share Tech Mono',monospace", fontSize:9, letterSpacing:1,
                  }}>
                    {tab === 'roster'   ? `👥 ROSTER${roster.filter(r=>r.name).length > 0 ? ' ✓' : ''}` : ''}
                    {tab === 'scouting' ? `🛩️ F-16 INTEL${boxScores.length > 0 ? ` (${boxScores.length})` : ''}` : ''}
                  </button>
                ))}
              </div>

              {/* Success / error banners */}
              {successMsg && (
                <div style={{
                  background:'rgba(0,229,160,0.1)', border:`1px solid rgba(0,229,160,0.3)`,
                  borderRadius:6, padding:'9px 14px',
                  fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:green,
                }}>{successMsg}</div>
              )}
              {error && (
                <div style={{
                  background:'rgba(255,59,48,0.1)', border:`1px solid rgba(255,59,48,0.3)`,
                  borderRadius:6, padding:'9px 14px',
                  fontFamily:"'DM Sans',sans-serif", fontSize:12, color:red,
                }}>{error}</div>
              )}

              {/* ── ROSTER TAB ── */}
              {activeTab === 'roster' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

                  {/* Scan lineup card */}
                  <div style={{
                    background:'rgba(0,212,255,0.04)', border:`1px solid rgba(0,212,255,0.15)`,
                    borderRadius:8, padding:14,
                  }}>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:cyan, letterSpacing:2, marginBottom:8 }}>
                      📸 SCAN LINEUP CARD
                    </div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:dim, marginBottom:10 }}>
                      Photo of a printed lineup card or GameChanger lineup screenshot.
                    </div>
                    <input ref={lineupFileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLineupScan} />
                    <button
                      onClick={() => lineupFileRef.current?.click()}
                      disabled={scanningLineup}
                      style={{
                        padding:'9px 18px', borderRadius:6, cursor: scanningLineup ? 'not-allowed' : 'pointer',
                        background: scanningLineup ? 'rgba(0,212,255,0.04)' : 'rgba(0,212,255,0.1)',
                        border:`1px solid rgba(0,212,255,${scanningLineup ? '0.15' : '0.4'})`,
                        color: scanningLineup ? dim : cyan,
                        fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
                      }}
                    >{scanningLineup ? '⟳ SCANNING...' : '📸 SCAN LINEUP CARD'}</button>
                  </div>

                  {/* Roster grid */}
                  <div>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:dim, letterSpacing:2, marginBottom:8 }}>
                      BATTING ORDER
                    </div>

                    {/* Header row */}
                    <div style={{ display:'grid', gridTemplateColumns:'32px 44px 1fr 52px 44px 24px', gap:6, marginBottom:4, padding:'0 2px' }}>
                      {['#','JERSEY','NAME','POS','SIDE',''].map(h => (
                        <div key={h} style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:7, color:dim, letterSpacing:1 }}>{h}</div>
                      ))}
                    </div>

                    {roster.map((row, i) => (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'32px 44px 1fr 52px 44px 24px', gap:6, marginBottom:5 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:gold, fontWeight:700 }}>
                          {row.lineup_order}
                        </div>
                        <input
                          value={row.jersey}
                          onChange={e => updateRow(i, 'jersey', e.target.value)}
                          placeholder="#"
                          style={inputStyle}
                        />
                        <input
                          value={row.name}
                          onChange={e => updateRow(i, 'name', e.target.value)}
                          placeholder="Player name"
                          style={{ ...inputStyle, fontFamily:"'DM Sans',sans-serif", fontSize:13 }}
                        />
                        <input
                          value={row.position}
                          onChange={e => updateRow(i, 'position', e.target.value.toUpperCase())}
                          placeholder="SS"
                          style={inputStyle}
                        />
                        <select
                          value={row.batter_type || 'R'}
                          onChange={e => updateRow(i, 'batter_type', e.target.value)}
                          style={{ ...inputStyle, padding:'4px 2px' }}
                        >
                          <option value="R">R</option>
                          <option value="L">L</option>
                          <option value="S">S</option>
                        </select>
                        <button onClick={() => removeRow(i)} style={{
                          background:'transparent', border:'none', color:'rgba(255,59,48,0.4)',
                          cursor:'pointer', fontSize:12, padding:0,
                        }}>✕</button>
                      </div>
                    ))}

                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={addRow} style={{
                        padding:'7px 14px', borderRadius:4, cursor:'pointer',
                        background:'transparent', border:`1px solid ${border}`,
                        color:dim, fontFamily:"'Share Tech Mono',monospace", fontSize:9,
                      }}>+ ADD ROW</button>

                      <button onClick={handleSaveRoster} style={{
                        flex:1, padding:'9px', borderRadius:6, cursor:'pointer',
                        background: rosterSaved ? 'rgba(0,229,160,0.12)' : 'rgba(245,166,35,0.1)',
                        border:`1px solid ${rosterSaved ? 'rgba(0,229,160,0.4)' : 'rgba(245,166,35,0.4)'}`,
                        color: rosterSaved ? green : gold,
                        fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
                      }}>
                        {rosterSaved ? '✓ SAVED — READY FOR GAME' : '💾 SAVE ROSTER'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SCOUTING TAB ── */}
              {activeTab === 'scouting' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

                  {/* Upload box scores */}
                  <div style={{
                    background:'rgba(245,166,35,0.04)', border:`1px solid rgba(245,166,35,0.15)`,
                    borderRadius:8, padding:14,
                  }}>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:gold, letterSpacing:2, marginBottom:8 }}>
                      🛩️ UPLOAD BOX SCORE SCREENSHOTS
                    </div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:dim, marginBottom:10, lineHeight:1.5 }}>
                      Upload 5-10 GameChanger box scores from any games {activeOpponent} has played.
                      More screenshots = smarter intel report.
                    </div>
                    <input ref={scoutingFileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={handleBoxScoreUpload} />
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button
                        onClick={() => scoutingFileRef.current?.click()}
                        disabled={uploadingBoxScore}
                        style={{
                          padding:'9px 18px', borderRadius:6, cursor: uploadingBoxScore ? 'not-allowed' : 'pointer',
                          background: uploadingBoxScore ? 'rgba(245,166,35,0.04)' : 'rgba(245,166,35,0.1)',
                          border:`1px solid rgba(245,166,35,${uploadingBoxScore ? '0.15' : '0.4'})`,
                          color: uploadingBoxScore ? dim : gold,
                          fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
                        }}
                      >{uploadingBoxScore ? `⟳ ${uploadProgress || 'PROCESSING...'}` : '📸 UPLOAD BOX SCORES'}</button>

                      {boxScores.length > 0 && (
                        <button onClick={() => handleGenerateReport()} disabled={generatingReport} style={{
                          padding:'9px 18px', borderRadius:6, cursor: generatingReport ? 'not-allowed' : 'pointer',
                          background: generatingReport ? 'rgba(0,212,255,0.04)' : 'rgba(0,212,255,0.1)',
                          border:`1px solid rgba(0,212,255,${generatingReport ? '0.15' : '0.4'})`,
                          color: generatingReport ? dim : cyan,
                          fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
                        }}>{generatingReport ? '⟳ GENERATING...' : '⚡ REGENERATE REPORT'}</button>
                      )}
                    </div>
                    {boxScores.length > 0 && (
                      <div style={{ marginTop:8, fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:green }}>
                        ● {boxScores.length} GAME{boxScores.length > 1 ? 'S' : ''} ON FILE
                      </div>
                    )}
                  </div>

                  {/* Generating state */}
                  {generatingReport && (
                    <div style={{ textAlign:'center', padding:'24px', fontFamily:"'Share Tech Mono',monospace", color:gold, fontSize:10 }}>
                      <div style={{ fontSize:20, marginBottom:8 }}>⚡</div>
                      ANALYZING {boxScores.length} GAMES...
                    </div>
                  )}

                  {/* Intel Report */}
                  {report && !generatingReport && (
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

                      {report.danger_zone?.length > 0 && (
                        <Section label="🎯 DANGER ZONE" color={red}>
                          {report.danger_zone.map((p, i) => (
                            <PlayerCard key={i} player={p} accentColor={red} threatColor={threatColor(p.threat_level)} showThreat={p.threat_level} />
                          ))}
                        </Section>
                      )}

                      {report.attack_zone?.length > 0 && (
                        <Section label="⚡ ATTACK ZONE" color={green}>
                          {report.attack_zone.map((p, i) => (
                            <PlayerCard key={i} player={p} accentColor={green} />
                          ))}
                        </Section>
                      )}

                      {report.pitcher_intel?.length > 0 && (
                        <Section label="⚾ PITCHER INTEL" color={cyan}>
                          {report.pitcher_intel.map((p, i) => (
                            <PlayerCard key={i} player={p} accentColor={cyan} showThreat={p.threat} threatColor={threatColor(p.threat)} />
                          ))}
                        </Section>
                      )}

                      {report.game_plan && (
                        <div style={{
                          background:'rgba(245,166,35,0.07)', border:`1px solid rgba(245,166,35,0.3)`,
                          borderRadius:8, padding:'13px 15px',
                        }}>
                          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:gold, letterSpacing:2, marginBottom:8 }}>
                            🎯 GAME PLAN
                          </div>
                          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:primary, lineHeight:1.7 }}>
                            {report.game_plan}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!report && !generatingReport && boxScores.length === 0 && (
                    <div style={{ textAlign:'center', padding:'30px', fontFamily:"'Share Tech Mono',monospace", color:dim, fontSize:10 }}>
                      <div style={{ fontSize:28, marginBottom:10 }}>🛩️</div>
                      NO INTEL ON FILE<br/>
                      <span style={{ fontSize:8 }}>Upload box score screenshots to build your scouting report</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

    {/* ── Roster Confirmation — fixed overlay, always on top ── */}
    {confirmingRoster && (
      <div style={{
        position:'fixed', inset:0, background:'rgba(5,12,28,0.97)',
        zIndex:2000, display:'flex', flexDirection:'column',
        padding:20, gap:12, overflowY:'auto',
      }}>
        <div style={{ maxWidth:640, width:'100%', margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'var(--gold)', letterSpacing:2 }}>
            ✅ CONFIRM PLAYER ROSTER
          </div>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:'var(--cyan)', letterSpacing:1 }}>
            vs {pendingExtracted?.game_vs || 'UNKNOWN OPPONENT'}
          </div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:'var(--text-dim)', lineHeight:1.5 }}>
            Review extracted names. Correct any wrong names before saving stats.
            ⚠️ = jersey or name mismatch · 🆕 = new player not in roster
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'52px 1fr 1fr', gap:8, padding:'4px 2px' }}>
            {['#','EXTRACTED','CONFIRM AS'].map(h => (
              <div key={h} style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:7, color:'var(--text-dim)', letterSpacing:1 }}>{h}</div>
            ))}
          </div>

          {confirmRows.map((row, i) => (
            <div key={i} style={{
              display:'grid', gridTemplateColumns:'52px 1fr 1fr', gap:8, alignItems:'center',
              background: row.flag ? 'rgba(245,166,35,0.07)' : row.isNew ? 'rgba(0,212,255,0.05)' : 'rgba(255,255,255,0.02)',
              border: '1px solid ' + (row.flag ? 'rgba(245,166,35,0.25)' : row.isNew ? 'rgba(0,212,255,0.2)' : 'var(--border)'),
              borderRadius:6, padding:'8px 10px',
            }}>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:13, color:'var(--gold)', fontWeight:700 }}>
                {row.jersey ? '#' + row.jersey : '—'}
              </div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {row.flag ? '⚠️ ' : row.isNew ? '🆕 ' : '✓ '}{row.extractedName || '—'}
              </div>
              <input
                value={row.confirmedName}
                onChange={e => updateConfirmRow(i, e.target.value)}
                placeholder={row.isNew ? 'Type correct name' : 'Confirm name'}
                style={{
                  background:'rgba(255,255,255,0.06)',
                  border:'1px solid ' + (row.flag ? 'rgba(245,166,35,0.5)' : row.isNew ? 'rgba(0,212,255,0.4)' : 'rgba(0,229,160,0.3)'),
                  borderRadius:4, color:'var(--text-primary)',
                  padding:'6px 8px', fontSize:13, width:'100%',
                  fontFamily:"'DM Sans',sans-serif", outline:'none',
                }}
              />
            </div>
          ))}

          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button
              onClick={() => { setConfirmingRoster(false); setUploadingBoxScore(false); setPendingExtracted(null); setConfirmRows([]) }}
              style={{
                padding:'10px 18px', borderRadius:6, cursor:'pointer',
                background:'transparent', border:'1px solid var(--border)',
                color:'var(--text-dim)', fontFamily:"'Share Tech Mono',monospace", fontSize:9,
              }}>✕ CANCEL</button>
            <button
              onClick={handleConfirmRoster}
              style={{
                flex:1, padding:'10px', borderRadius:6, cursor:'pointer',
                background:'rgba(0,229,160,0.12)', border:'1px solid rgba(0,229,160,0.5)',
                color:'var(--green)', fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1,
              }}>✓ CONFIRM ROSTER + SAVE STATS</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ── Small reusable sub-components ─────────────────────────────────────────────
function Section({ label, color, children }) {
  return (
    <div>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color, letterSpacing:2, marginBottom:8 }}>
        {label}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>{children}</div>
    </div>
  )
}

function PlayerCard({ player, accentColor, showThreat, threatColor }) {
  const border = `rgba(${accentColor === 'var(--red)' ? '255,59,48' : accentColor === 'var(--green)' ? '0,229,160' : '0,212,255'},0.15)`
  const bg     = `rgba(${accentColor === 'var(--red)' ? '255,59,48' : accentColor === 'var(--green)' ? '0,229,160' : '0,212,255'},0.04)`
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:7, padding:'11px 13px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <div style={{ fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>
          {player.jersey} {player.name} {player.position ? <span style={{ fontSize:10, color:'var(--text-dim)', fontWeight:400 }}>{player.position}</span> : null}
        </div>
        {showThreat && (
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:threatColor, padding:'2px 8px', borderRadius:3, border:`1px solid ${threatColor}`, opacity:0.8 }}>
            {showThreat}
          </div>
        )}
      </div>
      {player.stats && (
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:accentColor, marginBottom:5 }}>{player.stats}</div>
      )}
      {player.insight && (
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:'var(--text-primary)', lineHeight:1.5 }}>{player.insight}</div>
      )}
    </div>
  )
}

const inputStyle = {
  background:'rgba(255,255,255,0.04)',
  border:'1px solid var(--border)',
  borderRadius:4, color:'var(--text-primary)',
  padding:'6px 8px', fontSize:12, width:'100%',
  fontFamily:"'Share Tech Mono',monospace", outline:'none',
}
