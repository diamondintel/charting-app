// ─── Claude AI Integration — 4-Layer Intelligence System ─────────────────────
//
// Layer 1: Historical context — batter career data fed into every call
// Layer 2: Trigger-based prompts — purpose-built prompt per situation type
// Layer 3: Structured prompt engineering — specialized prompts per trigger
// Layer 4: Persistent memory — post-AB summaries saved back to DB for next game
//
// Architecture: rule-based fires instantly, Claude enriches async
// If Claude fails, silently falls back to rule-based. No crashes.

import { getBatterHistoricalData, saveAIBatterSummary } from './db.js'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const API_URL      = 'https://api.anthropic.com/v1/messages'

// ─── Rate limiting per trigger type ──────────────────────────────────────────
const callTimes = {}
const RATE_LIMITS = {
  pre_ab:       5000,
  mid_ab:       10000,
  two_strike:   6000,
  three_ball:   6000,
  third_time:   8000,
  hard_contact: 4000,
  post_inning:  3000,
}

function canCall(trigger) {
  const last = callTimes[trigger] || 0
  return Date.now() - last >= (RATE_LIMITS[trigger] || 8000)
}
function markCalled(trigger) { callTimes[trigger] = Date.now() }

// ─── Layer 2: Detect which trigger situation this is ─────────────────────────
export function detectTrigger({ paPitches, balls, strikes, gamePitches, batterName, lastOutcome }) {
  if (lastOutcome === 'IP') return 'hard_contact'
  if (strikes === 2 && paPitches.length >= 1) return 'two_strike'
  if (balls === 3) return 'three_ball'
  if (paPitches.length === 0) {
    const abCount = new Set(
      (gamePitches || []).filter(p => p.batter_name === batterName).map(p => p.pa_id)
    ).size
    if (abCount >= 2) return 'third_time'
    return 'pre_ab'
  }
  return 'mid_ab'
}

export const TRIGGER_LABELS = {
  pre_ab:       'PRE-AB SCOUT',
  two_strike:   '2-STRIKE',
  three_ball:   '3-BALL',
  third_time:   '3RD TIME THROUGH',
  hard_contact: 'ADJUSTMENT',
  mid_ab:       'MID-AB',
}

// ─── Layer 1: Build historical context string ─────────────────────────────────
function buildHistoricalContext(historicalData) {
  if (!historicalData || historicalData.pitches.length === 0) {
    return 'No prior game data for this batter.'
  }
  const { games, pitches, pas } = historicalData
  const total   = pitches.length
  const strCount = pitches.filter(p => ['CK','SK','F','IP'].includes(p.outcome_basic)).length
  const ks      = pas.filter(p => ['CK','SK'].includes(p.pa_result)).length
  const hits    = pas.filter(p => {
    return p.pa_result === 'IP' &&
      ['Single','Double','Triple','Home Run'].includes(p.outcome_inplay || '')
  }).length

  const byType = {}
  pitches.forEach(p => {
    const t = p.pitch_type || 'Unknown'
    if (!byType[t]) byType[t] = { total:0, strikes:0, ks:0, fouls:0 }
    byType[t].total++
    if (['CK','SK','F','IP'].includes(p.outcome_basic)) byType[t].strikes++
    if (['CK','SK'].includes(p.outcome_basic)) byType[t].ks++
    if (p.outcome_basic === 'F') byType[t].fouls++
  })

  const typeLines = Object.entries(byType)
    .filter(([,d]) => d.total >= 2)
    .sort((a,b) => b[1].total - a[1].total)
    .map(([type, d]) => {
      const strPct = Math.round(d.strikes / d.total * 100)
      const kPct   = Math.round(d.ks / d.total * 100)
      const foulNote = d.fouls >= 2 ? `, fouls ${d.fouls}x` : ''
      return `  ${type}: ${d.total}x seen, ${strPct}% strikes, ${kPct}% K${foulNote}`
    }).join('\n')

  const zoneHits = {}
  pitches.filter(p => p.outcome_basic === 'IP' && p.zone_row && p.zone_col)
    .forEach(p => {
      const z = `${p.zone_row}-${p.zone_col}`
      zoneHits[z] = (zoneHits[z] || 0) + 1
    })
  const dangerZones = Object.entries(zoneHits)
    .sort((a,b) => b[1]-a[1]).slice(0,2).map(([z,c]) => `zone ${z} (${c}x contact)`)

  const recentLines = games.slice(0,3).map(g => {
    const gPAs = pas.filter(p => p.game_id === g.game_id)
    const gKs  = gPAs.filter(p => ['CK','SK'].includes(p.pa_result)).length
    const date  = g.game_date?.slice(0,10) || '?'
    return `  ${date} vs ${g.opponent}: ${gPAs.length} AB, ${gKs} K`
  }).join('\n')

  return `CAREER DATA (${games.length} games, ${pas.length} AB total):
Overall: ${total} pitches, ${Math.round(strCount/Math.max(total,1)*100)}% strikes, ${ks} K's, ${hits} hits
Danger zones (contact): ${dangerZones.join(', ') || 'none identified'}
Per pitch type:
${typeLines || '  (insufficient data)'}
Recent games:
${recentLines || '  (none)'}`
}

// ─── Layer 3: Trigger-specific prompt builder ─────────────────────────────────
const TRIGGER_INSTRUCTIONS = {
  pre_ab: `PRE-AT-BAT SCOUTING BRIEF. Focus on opening pitch strategy based on historical data, batter tendencies to exploit first pitch, what to avoid. Use historical K rate by pitch type to recommend the highest-percentage opening. Be specific — reference the data.`,
  two_strike: `2-STRIKE PUT-AWAY. Focus on: which pitch has the highest K rate historically vs this batter, best chase zone, avoid anything she's fouling off this AB. Be decisive and high-confidence.`,
  three_ball: `3-BALL COUNT — must throw a strike. Recommend safest command pitch. Avoid her danger zones. Do not walk her. Conservative but strategic.`,
  third_time: `THIRD TIME THROUGH LINEUP. She has now seen this pitcher twice today and will be adjusting. Focus on: what sequences to flip, inject something unexpected, what she's been sitting on. The historical pattern data is critical.`,
  hard_contact: `HARD CONTACT — immediate adjustment. What pitch/zone just got hit? What to throw next to disrupt timing. Be urgent and specific about the change needed.`,
  mid_ab: `MID-AB GUIDANCE. Count-appropriate pitch selection. What patterns are building this AB? Best next pitch given the sequence so far.`,
}

function buildPrompt(trigger, context, historicalContext) {
  const {
    batter, batterType, balls, strikes, outs, inning, topBottom,
    ourRuns, oppRuns, on1b, on2b, on3b,
    paPitches, gamePitches, arsenal, pitcherName, pci,
    hitterNote, aiMemory
  } = context

  const runners    = [on1b&&'1B', on2b&&'2B', on3b&&'3B'].filter(Boolean).join('+') || 'bases empty'
  const scoreDiff  = ourRuns - oppRuns
  const paHistory  = paPitches.length === 0
    ? '(first pitch of AB)'
    : paPitches.map((p,i) => `  P${i+1}: ${p.pitch_type} zone ${p.zone_row}-${p.zone_col} → ${p.outcome_basic}`).join('\n')

  const todayABs = (() => {
    const bp = gamePitches.filter(p => p.batter_name === batter?.name)
    const byPA = {}
    bp.forEach(p => { if (!byPA[p.pa_id]) byPA[p.pa_id]=[]; byPA[p.pa_id].push(p) })
    const list = Object.values(byPA)
    if (!list.length) return 'First AB today'
    return list.map((pa,i) => {
      const last = pa[pa.length-1]
      return `  AB${i+1}: ${pa.length} pitches, ended ${last.pitch_type} zone ${last.zone_row}-${last.zone_col} → ${last.outcome_basic}`
    }).join('\n')
  })()

  const pitcherToday = (() => {
    const total = gamePitches.length
    const str   = gamePitches.filter(p => ['CK','SK','F','IP'].includes(p.outcome_basic)).length
    const byType = {}
    gamePitches.forEach(p => {
      if (!byType[p.pitch_type]) byType[p.pitch_type]={t:0,s:0}
      byType[p.pitch_type].t++
      if (['CK','SK','F','IP'].includes(p.outcome_basic)) byType[p.pitch_type].s++
    })
    const types = Object.entries(byType).sort((a,b)=>b[1].t-a[1].t)
      .map(([t,d]) => `${t}:${Math.round(d.s/d.t*100)}%str`).join(', ')
    return `${total} pitches, ${Math.round(str/Math.max(total,1)*100)}% strikes. ${types}. PCI:${pci?.score||'—'}/100`
  })()

  const coachLines = [
    hitterNote?.tags?.length>0 && `Scout tags: ${hitterNote.tags.join(', ')}`,
    hitterNote?.text && `Coach note: "${hitterNote.text}"`,
    aiMemory && `Prior scouting note: "${aiMemory}"`,
  ].filter(Boolean).join('\n')

  return `You are a youth softball pitching coach assistant. ${TRIGGER_INSTRUCTIONS[trigger] || TRIGGER_INSTRUCTIONS.mid_ab}

GAME SITUATION
Pitcher: ${pitcherName} | Arsenal: ${arsenal.join(', ')}
Batter: ${batter?.name||'?'} | Type: ${batterType} | Lineup #${batter?.lineup_order||'?'}
Count: ${balls}-${strikes} | ${outs} outs | ${runners}
Score: Us ${ourRuns} — Them ${oppRuns} (${scoreDiff>=0?'+':''}${scoreDiff}) | Inning ${inning} ${topBottom==='top'?'▲':'▼'}
${coachLines ? `\nCOACH CONTEXT\n${coachLines}` : ''}
THIS AB SO FAR
${paHistory}

BATTER TODAY
${todayABs}

PITCHER TODAY
${pitcherToday}

${historicalContext}

Respond ONLY in this exact JSON format, no other text:
{
  "recommendations": [
    {"pitch": "FASTBALL", "zone": "3-2", "zoneName": "LOW · MID", "confidence": 72, "reasons": ["reason 1", "reason 2"]},
    {"pitch": "DROP", "zone": "3-3", "zoneName": "LOW · OUT", "confidence": 58, "reasons": ["reason 1"]},
    {"pitch": "CHANGEUP", "zone": "2-3", "zoneName": "MID · OUT", "confidence": 44, "reasons": ["reason 1"]}
  ],
  "signals": [
    {"type": "warn", "text": "max 12 words"},
    {"type": "ok",   "text": "max 12 words"},
    {"type": "info", "text": "max 12 words"}
  ]
}`
}

// ─── Primary export: live in-game recommendations ────────────────────────────
export async function getClaudeRecommendations(context) {
  const trigger = detectTrigger({
    paPitches:   context.paPitches,
    balls:       context.balls,
    strikes:     context.strikes,
    gamePitches: context.gamePitches,
    batterName:  context.batter?.name,
    lastOutcome: context.paPitches.at?.(-1)?.outcome_basic,
  })

  if (!canCall(trigger)) return null
  markCalled(trigger)

  try {
    // Layer 1 — historical context (parallel with everything else)
    const historicalData = context.teamId && context.batter?.name && context.opponent
      ? await getBatterHistoricalData(
          context.teamId, context.batter.name, context.opponent
        ).catch(() => null)
      : null

    const historicalContext = buildHistoricalContext(historicalData)

    // Layer 3 — trigger-specific prompt
    const prompt   = buildPrompt(trigger, context, historicalContext)
    const result   = await callClaudeAPI(prompt, 700)

    if (!result?.recommendations || !result?.signals) return null
    return { ...result, trigger }

  } catch (e) {
    console.warn(`Claude (${trigger}) failed, using rule-based:`, e.message)
    return null
  }
}

// ─── Layer 4: Post-AB persistent memory ──────────────────────────────────────
export async function generatePostABSummary({ teamId, opponent, batter, paPitches, allGamePAs, pitcherName, arsenal }) {
  if (!teamId || !opponent || !batter?.name || paPitches.length === 0) return null

  try {
    const batterPAs = allGamePAs.filter(p => p.batter_name === batter.name)
    const lastPA    = batterPAs[batterPAs.length - 1]
    const result    = lastPA?.pa_result || 'unknown'
    const seq       = paPitches.map((p,i) =>
      `P${i+1}: ${p.pitch_type} zone ${p.zone_row}-${p.zone_col} → ${p.outcome_basic}`
    ).join(', ')

    const prompt = `You are a softball scouting system. Write a BRIEF BATTER SCOUTING NOTE (2-3 sentences) for coaches to read before the next matchup.
Focus on: what pitch/zone produced the result, timing tells observed, what to remember.
Be tactical and specific — not generic.

Batter: ${batter.name} (${batter.batter_type||'unknown'} hitter)
Result: ${result}
Pitch sequence: ${seq}
Pitcher arsenal: ${arsenal.join(', ')}

Respond with ONLY the scouting note. 2-3 sentences maximum. No labels, no JSON.`

    const data = await callClaudeAPI(prompt, 150)
    // Post-AB returns plain text not JSON
    const summary = typeof data === 'string' ? data : data?.choices?.[0]?.text
    if (!summary) return null

    await saveAIBatterSummary(teamId, opponent, batter.name, summary)
    return summary
  } catch (e) {
    console.warn('Post-AB summary failed:', e.message)
    return null
  }
}

// ─── Internal API caller ──────────────────────────────────────────────────────
async function callClaudeAPI(prompt, maxTokens) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''
  // Try JSON parse, fall back to raw text (for post-AB plain text responses)
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return text.trim()
  }
}
