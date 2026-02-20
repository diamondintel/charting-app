// ─── Count logic ──────────────────────────────────────────────────────────────

export const OUTCOME_CODES = {
  BALL: 'B', CALLED_K: 'CK', SWING_K: 'SK',
  FOUL: 'F', IN_PLAY: 'IP', HBP: 'HBP',
}

export const STRIKE_OUTCOMES  = new Set(['CK', 'SK', 'F'])
export const BALL_OUTCOMES    = new Set(['B', 'HBP'])
export const PA_END_OUTCOMES  = new Set(['CK', 'SK', 'IP', 'HBP'])
export const WHIFF_OUTCOMES   = new Set(['CK', 'SK'])
export const HIT_RESULTS      = new Set(['Single','Double','Triple','Home Run'])

export function advanceCount(balls, strikes, outcome) {
  if (outcome === 'B')                    return { balls: Math.min(balls + 1, 4), strikes }
  if (outcome === 'F')                    return { balls, strikes: Math.min(strikes + 1, 2) }
  if (outcome === 'CK' || outcome === 'SK') return { balls, strikes: Math.min(strikes + 1, 3) }
  if (outcome === 'IP' || outcome === 'HBP') return { balls: 0, strikes: 0 }
  return { balls, strikes }
}

export function isWalk(balls)       { return balls >= 4 }
export function isStrikeout(strikes){ return strikes >= 3 }

// ─── Count state ──────────────────────────────────────────────────────────────

function countState(balls, strikes) {
  if (balls === 0 && strikes === 0)  return 'even'
  if (balls <= 1 && strikes >= 1)    return 'ahead'
  if (balls >= 3)                    return 'behind'
  if (balls === 2 && strikes < 2)    return 'behind'
  return 'even'
}

// ─── Pitch stats ──────────────────────────────────────────────────────────────

export function computePitchStats(pitches) {
  const total = pitches.length
  if (total === 0) return { strikeRate: 0, fps: 0, whiffRate: 0, pitchCount: 0 }
  const strikes     = pitches.filter(p => STRIKE_OUTCOMES.has(p.outcome_basic)).length
  const firstPitches = pitches.filter(p => p.balls_before === 0 && p.strikes_before === 0)
  const fps          = firstPitches.length > 0
    ? firstPitches.filter(p => STRIKE_OUTCOMES.has(p.outcome_basic)).length / firstPitches.length : 0
  const swings = pitches.filter(p => ['SK','IP'].includes(p.outcome_basic)).length
  const whiffs  = pitches.filter(p => p.outcome_basic === 'SK').length
  return {
    strikeRate: Math.round((strikes / total) * 100),
    fps:        Math.round(fps * 100),
    whiffRate:  swings > 0 ? Math.round((whiffs / swings) * 100) : 0,
    pitchCount: total,
  }
}

export function pitchTypeBreakdown(pitches) {
  const counts = {}
  pitches.forEach(p => { counts[p.pitch_type] = (counts[p.pitch_type] || 0) + 1 })
  const total = pitches.length || 1
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
}

export function pitchEffectiveness(pitches) {
  const byType = {}
  pitches.forEach(p => {
    if (!byType[p.pitch_type]) byType[p.pitch_type] = { strikes: 0, total: 0 }
    byType[p.pitch_type].total++
    if (STRIKE_OUTCOMES.has(p.outcome_basic)) byType[p.pitch_type].strikes++
  })
  return Object.entries(byType)
    .map(([type, d]) => ({ type, pct: Math.round((d.strikes / d.total) * 100), total: d.total }))
    .sort((a, b) => b.pct - a.pct)
}

// ─── LAYER 4: PCI — Pitcher Confidence Index ──────────────────────────────────

export function computePCI(gamePitches) {
  if (gamePitches.length < 5) return { score: 70, band: 'normal', label: 'BUILDING DATA' }
  const total    = gamePitches.length
  const strikes  = gamePitches.filter(p => STRIKE_OUTCOMES.has(p.outcome_basic)).length
  const strikeRate = strikes / total
  const fp       = gamePitches.filter(p => p.balls_before === 0 && p.strikes_before === 0)
  const fpsRate  = fp.length > 0
    ? fp.filter(p => STRIKE_OUTCOMES.has(p.outcome_basic)).length / fp.length : 0.5
  let repeatedMisses = 0
  for (let i = 1; i < gamePitches.length; i++) {
    const prev = gamePitches[i-1], curr = gamePitches[i]
    if (prev.command_quality && curr.command_quality &&
        prev.command_quality !== 'executed' &&
        prev.command_quality === curr.command_quality) repeatedMisses++
  }
  const missRate        = repeatedMisses / Math.max(total - 1, 1)
  const hardContactRate = gamePitches.filter(p => p.hard_contact).length / total
  let pci = 50
  pci += (strikeRate - 0.55) * 60
  pci += (fpsRate - 0.55) * 30
  pci -= missRate * 40
  pci -= hardContactRate * 30
  pci = Math.max(10, Math.min(100, Math.round(pci)))
  const band  = pci >= 80 ? 'hot' : pci >= 55 ? 'normal' : 'off'
  const label = pci >= 80 ? 'HOT — EXPAND & ATTACK'
              : pci >= 55 ? 'ON TARGET — STANDARD SEQ'
              : 'OFF TODAY — SIMPLIFY'
  return { score: pci, band, label }
}

// ─── LAYER 3: Leverage Multiplier ────────────────────────────────────────────

export function computeLeverage(inning, outs, on1b, on2b, on3b, ourRuns, oppRuns) {
  const scoreDiff = ourRuns - oppRuns
  const runnersOn = (on1b?1:0) + (on2b?1:0) + (on3b?1:0)
  const lateGame  = inning >= 5
  let lm = 1.0
  if (on3b && outs < 2)         lm += 0.4
  if (on2b && outs < 2)         lm += 0.2
  if (runnersOn >= 2)            lm += 0.15
  if (lateGame)                  lm += 0.15
  if (Math.abs(scoreDiff) <= 1) lm += 0.2
  if (Math.abs(scoreDiff) <= 0) lm += 0.1
  if (Math.abs(scoreDiff) >= 5) lm = Math.max(0.8, lm - 0.3)
  return Math.min(1.6, Math.round(lm * 10) / 10)
}

// ─── LAYER 6: Pattern Reveal Risk ────────────────────────────────────────────

export function computePRR(paPitches, allBatterPitches) {
  let prr = 0
  if (paPitches.length < 2) return prr
  const types  = paPitches.map(p => p.pitch_type)
  const last3  = types.slice(-3)
  if (last3.length >= 2 && new Set(last3.slice(-2)).size === 1) prr += 25
  if (last3.length >= 3 && new Set(last3).size === 1)           prr += 25
  const rows = paPitches.map(p => p.zone_row).filter(Boolean)
  if (rows.length >= 2) {
    const lr = rows.slice(-3)
    if (lr.every(r => r === 1))       prr += 20
    if (lr.every(r => r === 3))       prr += 20
    if (lr.every(r => r === lr[0]))   prr += 10
  }
  const fouls = paPitches.filter(p => p.outcome_basic === 'F')
  if (fouls.length >= 2) {
    if (new Set(fouls.map(p => p.pitch_type)).size === 1) prr += 30
  }
  if (allBatterPitches?.length > 0) {
    const paIds = [...new Set(allBatterPitches.map(p => p.pa_id))]
    if (paIds.length >= 2) prr += 15
    if (paIds.length >= 3) prr += 15
  }
  return Math.min(100, prr)
}

// ─── LAYER 2: Same-game batter history ───────────────────────────────────────

export function analyzeBatterHistory(allGamePitches, batterName) {
  const bp = allGamePitches.filter(p => p.batter_name === batterName)
  if (bp.length === 0) return null
  const byPA = {}
  bp.forEach(p => { if (!byPA[p.pa_id]) byPA[p.pa_id] = []; byPA[p.pa_id].push(p) })
  const paList  = Object.values(byPA)
  const lastPA  = paList[paList.length - 1]
  const fouledOff = bp.filter(p => p.outcome_basic === 'F')
    .reduce((a,p) => { a[p.pitch_type]=(a[p.pitch_type]||0)+1; return a }, {})
  const outByType = bp.filter(p => ['CK','SK'].includes(p.outcome_basic))
    .reduce((a,p) => { a[p.pitch_type]=(a[p.pitch_type]||0)+1; return a }, {})
  let lastABSummary = null
  if (lastPA?.length > 0) {
    const fp = lastPA[lastPA.length - 1]
    const resultLabel = fp.outcome_basic === 'CK' ? 'Called K'
      : fp.outcome_basic === 'SK' ? 'Swing K'
      : fp.outcome_basic === 'IP' ? (fp.outcome_inplay || 'In Play')
      : fp.outcome_basic === 'B'  ? 'Walk' : fp.outcome_basic
    lastABSummary = {
      pitchCount: lastPA.length,
      endedOn:    fp.pitch_type,
      endedZone:  fp.zone_row && fp.zone_col ? `${fp.zone_row}-${fp.zone_col}` : '—',
      result:     resultLabel,
      count:      `${fp.balls_before}-${fp.strikes_before}`,
    }
  }
  return {
    atBats: paList.length, totalPitches: bp.length,
    fouledOff, outByType, lastABSummary,
    isSecondAB: paList.length >= 2,
    isThirdAB:  paList.length >= 3,
  }
}

// ─── LAYER 5: Reverse Switch ──────────────────────────────────────────────────

export function checkReverseSwitch(balls, strikes, pci, tendency, arsenal, on3b, lm) {
  const hitterCount = balls === 3 || (balls === 2 && strikes <= 1)
  if (!hitterCount)      return null
  if (pci.score < 55)    return null
  if (on3b && lm >= 1.4) return null
  const hasChangeup  = arsenal.some(a => a.toLowerCase().includes('change'))
  const hasDrop      = arsenal.some(a => a.toLowerCase().includes('drop'))
  const reversePitch = hasChangeup ? 'Changeup' : hasDrop ? 'Drop' : null
  if (!reversePitch) return null
  const countLabel = `${balls}-${strikes}`
  if (tendency === 'patient') {
    return {
      active: true, type: 'standard',
      pitch:  arsenal.find(a => a === 'Fastball') || arsenal[0],
      zone:   '3-2',
      rationale: `${countLabel} COUNT — Patient hitter. FB edge away — steal the strike.`,
      avoid: ['middle-middle', 'anything cute'],
    }
  }
  return {
    active: true, type: 'reverse',
    pitch:  reversePitch,
    zone:   '3-3',
    rationale: `${countLabel} COUNT — Aggressive hitter expecting FB. REVERSE → ${reversePitch} bottom edge. Disrupt timing.`,
    avoid: ['Fastball middle', 'anything elevated'],
  }
}

// ─── LAYER 1: First-pitch brief ───────────────────────────────────────────────

export function buildFirstPitchBrief(pitcher, batterPlayer, allHistoricalPitches, arsenal) {
  const lines = []
  if (pitcher) {
    const style = pitcher.pitching_style || ''
    const lead  = style === 'power'    ? (arsenal.find(a => a === 'Fastball') || arsenal[0])
                : style === 'movement' ? (arsenal.find(a => a === 'Drop') || arsenal[0])
                : (arsenal.find(a => a === 'Changeup') || arsenal[0])
    if (lead) lines.push({ type: 'info', text: `Lead with ${lead} — fits ${style || 'pitcher'} profile` })
  }
  if (allHistoricalPitches?.length > 0 && batterPlayer) {
    const hp = allHistoricalPitches.filter(p => p.batter_name === batterPlayer.name)
    if (hp.length > 0) {
      const kByType = hp.filter(p => ['CK','SK'].includes(p.outcome_basic))
        .reduce((a,p) => { a[p.pitch_type]=(a[p.pitch_type]||0)+1; return a }, {})
      const bestK = Object.entries(kByType).sort((a,b)=>b[1]-a[1])[0]
      if (bestK) lines.push({ type: 'ok', text: `Historical: ${bestK[1]} K${bestK[1]>1?'s':''} on ${bestK[0]} vs this batter` })
      const hardByType = hp.filter(p => p.hard_contact)
        .reduce((a,p) => { a[p.pitch_type]=(a[p.pitch_type]||0)+1; return a }, {})
      const mostHard = Object.entries(hardByType).sort((a,b)=>b[1]-a[1])[0]
      if (mostHard) lines.push({ type: 'warn', text: `Caution: Hard contact on ${mostHard[0]} (${mostHard[1]}x historically)` })
    }
  }
  const bt = batterPlayer?.batter_type || 'unknown'
  if (bt === 'power')   lines.push({ type: 'info', text: 'Power hitter — attack edges, avoid middle' })
  if (bt === 'slapper') lines.push({ type: 'info', text: 'Slapper — pitch inside, limit pull angle' })
  if (bt === 'contact') lines.push({ type: 'info', text: 'Contact hitter — change speeds early' })
  return lines.slice(0, 3)
}

// ─── Master signal generator ──────────────────────────────────────────────────

export function generateSignals(
  paPitches, balls, strikes, batterType,
  { gamePitches, batterName, batterPlayer, pitcher,
    inning, outs, on1b, on2b, on3b, ourRuns, oppRuns,
    allHistoricalPitches } = {}
) {
  const signals = []
  const n       = paPitches.length
  const state   = countState(balls, strikes)
  const lm      = computeLeverage(inning||1, outs||0, on1b, on2b, on3b, ourRuns||0, oppRuns||0)

  // Layer 3 — situation
  if (on3b && outs < 2)
    signals.push({ type:'warn', priority:10, text:`Runner on 3rd <2 outs — NO bouncing pitch. Passed ball scores the run.` })
  if (lm >= 1.4 && !on3b)
    signals.push({ type:'warn', priority:9,  text:`High leverage (LM ${lm}) — work edges only, no gifts in the zone` })
  const scoreDiff = (ourRuns||0) - (oppRuns||0)
  if (Math.abs(scoreDiff) <= 1 && (inning||1) >= 5)
    signals.push({ type:'warn', priority:8,  text:`Close game, late inning — every pitch counts. Protect the zone.` })

  // Layer 2 — batter history
  const history = gamePitches && batterName ? analyzeBatterHistory(gamePitches, batterName) : null
  if (history?.isSecondAB && history.lastABSummary) {
    const s = history.lastABSummary
    signals.push({ type:'info', priority:9, text:`Last AB: ${s.result} on ${s.endedOn} (zone ${s.endedZone}) — count was ${s.count}` })
  }
  if (history?.isThirdAB)
    signals.push({ type:'warn', priority:8, text:`3rd time through — inject Changeup early, she's adjusting` })
  const topFoul = history?.fouledOff ? Object.entries(history.fouledOff).sort((a,b)=>b[1]-a[1])[0] : null
  if (topFoul?.[1] >= 2)
    signals.push({ type:'warn', priority:8, text:`Fouled off ${topFoul[1]} ${topFoul[0]}s this game — she's timing it, change look` })
  const topOut = history?.outByType ? Object.entries(history.outByType).sort((a,b)=>b[1]-a[1])[0] : null
  if (topOut && history?.isSecondAB)
    signals.push({ type:'ok', priority:7, text:`Got her on ${topOut[0]} last AB — go back to it in similar count` })

  // PRR
  const prr = computePRR(paPitches, gamePitches?.filter(p=>p.batter_name===batterName))
  if (prr >= 60)
    signals.push({ type:'warn', priority:8, text:`Pattern risk HIGH (${prr}/100) — must change pitch type or plane` })
  else if (prr >= 35)
    signals.push({ type:'info', priority:6, text:`Pattern building (${prr}/100) — consider mixing it up` })

  // Plane rule
  if (n >= 2) {
    const rows = paPitches.slice(-3).map(p => p.zone_row).filter(Boolean)
    if (rows.length >= 2 && rows.every(r => r === 1))
      signals.push({ type:'warn', priority:7, text:'All pitches HIGH — must change plane, go low' })
    if (rows.length >= 2 && rows.every(r => r === 3))
      signals.push({ type:'warn', priority:7, text:'All pitches LOW — change plane, go up or mid' })
  }

  // Repeated pitch
  if (n >= 2) {
    const lastTwo = paPitches.slice(-2).map(p => p.pitch_type)
    if (lastTwo[0] === lastTwo[1])
      signals.push({ type:'warn', priority:7, text:`2 straight ${lastTwo[0]}s — batter may be timing, change pitch` })
  }

  // Foul-off pattern this PA
  const fouls = paPitches.filter(p => p.outcome_basic === 'F')
  if (fouls.length >= 2 && new Set(fouls.map(p=>p.pitch_type)).size === 1)
    signals.push({ type:'warn', priority:9, text:`Fouled off ${fouls.length} ${fouls[0].pitch_type}s in a row — she's ON it, go elsewhere` })

  // Count-based
  if (state === 'ahead' && strikes === 2)
    signals.push({ type:'ok', priority:6, text:'2-strike: expand low/away, chase zone is yours' })
  if (balls === 3 && strikes < 2)
    signals.push({ type:'warn', priority:8, text:'3-ball count — best command pitch only, protect middle' })
  if (balls === 2 && strikes === 0)
    signals.push({ type:'warn', priority:7, text:'2-0: hitter sitting FB — consider speed change' })

  // First pitch Layer 1
  if (n === 0) {
    if (pitcher && batterPlayer) {
      const brief = buildFirstPitchBrief(pitcher, batterPlayer, allHistoricalPitches, pitcher.pitcher_arsenal||[])
      brief.forEach(b => signals.push({ ...b, priority: 5 }))
    } else {
      signals.push({ type:'info', priority:4, text:'First pitch — attack the zone, get ahead early' })
    }
    if (batterType === 'slapper')
      signals.push({ type:'info', priority:5, text:'Slapper at plate — pitch inside, reduces pull angle' })
  }

  return signals.sort((a,b)=>b.priority-a.priority).slice(0,5).map(({priority,...s})=>s)
}

// ─── 5-factor recommendation engine ──────────────────────────────────────────

const ZONE_NAMES = {
  '1-1':'HIGH · IN',  '1-2':'HIGH · MID', '1-3':'HIGH · OUT',
  '2-1':'MID · IN',   '2-2':'HEART',      '2-3':'MID · OUT',
  '3-1':'LOW · IN',   '3-2':'LOW · MID',  '3-3':'LOW · OUT',
}
const MOVEMENT_PITCHES = new Set(['Drop','Curve','Drop-Curve','Screw','Rise'])
const BREAKING_PITCHES = new Set(['Drop','Curve','Drop-Curve','Screw'])

export function generateRecommendations(
  paPitches, balls, strikes, batterType, arsenal,
  { pci, lm, prr, gamePitches, batterName } = {}
) {
  if (!arsenal?.length) return []
  const pciScore = pci?.score || 70
  const lmVal    = lm || 1.0
  const prrVal   = prr || 0
  const state    = countState(balls, strikes)
  const usedZones = new Set(paPitches.map(p => `${p.zone_row}-${p.zone_col}`))
  const typeCount = {}
  paPitches.forEach(p => { typeCount[p.pitch_type]=(typeCount[p.pitch_type]||0)+1 })
  const total   = paPitches.length || 1
  const history = gamePitches && batterName ? analyzeBatterHistory(gamePitches, batterName) : null

  return arsenal.map(pitchType => {
    const usage = (typeCount[pitchType]||0) / total
    let score = 50

    // 1. Count fit (0-30)
    if (state === 'ahead') {
      if (BREAKING_PITCHES.has(pitchType)) score += 20
      if (strikes === 2 && BREAKING_PITCHES.has(pitchType)) score += 10
    } else if (state === 'behind') {
      if (pitchType === 'Fastball') score += 20
      if (BREAKING_PITCHES.has(pitchType) && pciScore < 65) score -= 15
    } else {
      if (pitchType === 'Fastball') score += 10
      if (pitchType === 'Changeup') score += 8
    }

    // 2. Command fit (0-25)
    if (pciScore >= 80)       score += 20
    else if (pciScore >= 55)  score += 10
    else { if (pitchType === 'Fastball') score += 10; else score -= 15 }

    // 3. Hitter tendencies (0-20)
    if (batterType === 'power') {
      if (MOVEMENT_PITCHES.has(pitchType)) score += 15
      if (pitchType === 'Fastball')         score -= 5
    }
    if (batterType === 'contact') {
      if (pitchType === 'Changeup')         score += 15
      if (BREAKING_PITCHES.has(pitchType)) score += 8
    }
    if (batterType === 'slapper') {
      if (['Rise','Screw','Fastball'].includes(pitchType)) score += 12
    }

    // 4. Safety × LM (0-30)
    if (lmVal >= 1.4) {
      if (['Drop','Curve','Drop-Curve'].includes(pitchType)) score -= 20
      if (batterType === 'power' && pitchType === 'Fastball') score -= 10
    }
    if (lmVal >= 1.2 && state === 'behind' && pitchType !== 'Fastball') score -= 10
    score += (0.3 - usage) * 15

    // 5. Matchup edge (-10 to +10)
    if (history?.outByType?.[pitchType])      score += Math.min(10, history.outByType[pitchType] * 5)
    if ((history?.fouledOff?.[pitchType]||0) >= 2) score -= 8

    // PRR pattern break
    if (prrVal >= 50 && usage > 0)   score -= 15
    if (prrVal >= 50 && usage === 0) score += 10

    // Zone
    let bestZone = '2-3'
    const reasons = []
    if (state === 'ahead' && strikes === 2) {
      bestZone = usedZones.has('3-3') ? '3-2' : '3-3'
      reasons.push('2-strike: expand low away')
    } else if (state === 'behind') {
      bestZone = usedZones.has('2-3') ? '2-1' : '2-3'
      reasons.push('Behind in count: edge strike only')
    } else {
      bestZone = usedZones.has('3-2') ? '3-3' : '3-2'
    }
    if (!usedZones.has(bestZone)) reasons.push('Zone unexplored this PA')
    if (history?.outByType?.[pitchType]) reasons.push(`Got her on ${pitchType} last AB`)
    if ((history?.fouledOff?.[pitchType]||0) >= 2) reasons.push(`She's timing the ${pitchType}`)
    if (batterType === 'power' && MOVEMENT_PITCHES.has(pitchType)) reasons.push('Movement disrupts power hitter timing')
    if (pciScore >= 80) reasons.push('Pitcher is sharp today — trust it')
    if (pciScore < 55)  reasons.push('Off day — keep it simple')

    return {
      pitch:      pitchType.toUpperCase(),
      zone:       bestZone,
      zoneName:   ZONE_NAMES[bestZone] || bestZone,
      confidence: Math.max(15, Math.min(95, Math.round(score))),
      reasons:    reasons.slice(0, 3),
    }
  }).sort((a,b) => b.confidence - a.confidence).slice(0, 3)
}

// ─── Color maps ───────────────────────────────────────────────────────────────

export const OUTCOME_COLORS = {
  B:   { color: '#00D4FF', label: 'BALL' },
  CK:  { color: '#FF4D6A', label: 'CALLED K' },
  SK:  { color: '#FF4D6A', label: 'SWING K' },
  F:   { color: '#FFB347', label: 'FOUL' },
  IP:  { color: '#00E5A0', label: 'IN PLAY' },
  HBP: { color: '#a78bfa', label: 'HBP' },
}

export const PITCH_COLORS = {
  Fastball: '#00D4FF', Changeup: '#00E5A0', Drop: '#F5A623',
  Rise: '#FF4D6A', Curve: '#a78bfa', Screw: '#FFB347', 'Drop-Curve': '#F5A623',
}
