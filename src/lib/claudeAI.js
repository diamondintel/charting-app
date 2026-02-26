// ─── Claude API Integration ───────────────────────────────────────────────────
// Layered approach: rule-based engine fires instantly, Claude enriches async
// Uses claude-sonnet-4-20250514 via Anthropic API (key injected by proxy)

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const API_URL = 'https://api.anthropic.com/v1/messages'

// Rate limiting — don't call Claude more than once per 8 seconds
let lastCallTime = 0
const MIN_INTERVAL_MS = 8000

function canCallClaude() {
  return Date.now() - lastCallTime >= MIN_INTERVAL_MS
}

function buildGameContext({ 
  batter, batterType, balls, strikes, outs, inning, topBottom,
  ourRuns, oppRuns, on1b, on2b, on3b,
  paPitches, gamePitches, arsenal, pitcherName,
  pci, hitterNote
}) {
  const runnerDesc = [on1b&&'1st', on2b&&'2nd', on3b&&'3rd'].filter(Boolean).join(', ') || 'none'
  const paHistory = paPitches.map((p,i) => 
    `  Pitch ${i+1}: ${p.pitch_type} → zone ${p.zone_row}-${p.zone_col} → ${p.outcome_basic}`
  ).join('\n')

  const gameStats = (() => {
    const total = gamePitches.length
    const strikes = gamePitches.filter(p => ['CK','SK','F','IP'].includes(p.outcome_basic)).length
    const byType = {}
    gamePitches.forEach(p => {
      if (!byType[p.pitch_type]) byType[p.pitch_type] = { total:0, strikes:0 }
      byType[p.pitch_type].total++
      if (['CK','SK','F','IP'].includes(p.outcome_basic)) byType[p.pitch_type].strikes++
    })
    const typeStr = Object.entries(byType).map(([t,d]) => 
      `${t}: ${d.total} thrown (${Math.round(d.strikes/d.total*100)}% strikes)`
    ).join(', ')
    return `Total: ${total} pitches, ${Math.round(strikes/Math.max(total,1)*100)}% strikes. ${typeStr}`
  })()

  const batterHistory = (() => {
    const bp = gamePitches.filter(p => p.batter_name === batter?.name)
    if (bp.length === 0) return 'First time facing this batter today'
    const byPA = {}
    bp.forEach(p => { if (!byPA[p.pa_id]) byPA[p.pa_id] = []; byPA[p.pa_id].push(p) })
    const pas = Object.values(byPA)
    return `${pas.length} previous AB(s) today, ${bp.length} total pitches seen`
  })()

  return `
SOFTBALL PITCH INTELLIGENCE — LIVE GAME CONTEXT
================================================

SITUATION
- Inning: ${inning} ${topBottom === 'top' ? '▲ TOP' : '▼ BOTTOM'}
- Count: ${balls}-${strikes}, ${outs} outs
- Score: Us ${ourRuns} — Them ${oppRuns}
- Runners: ${runnerDesc}

BATTER
- Name: ${batter?.name || 'Unknown'}
- Jersey: #${batter?.jersey || '?'}
- Type: ${batterType || 'unknown'} hitter
- Lineup spot: ${batter?.lineup_order || '?'}
${hitterNote?.tags?.length > 0 ? `- Scout tags: ${hitterNote.tags.join(', ')}` : ''}
${hitterNote?.text ? `- Coach note: "${hitterNote.text}"` : ''}

PITCHER
- Name: ${pitcherName}
- Arsenal: ${arsenal.join(', ')}
- Command index (PCI): ${pci?.score || '—'}/100 (${pci?.label || '—'})

THIS AT-BAT SO FAR
${paHistory || '  (no pitches yet — first pitch)'}

BATTER HISTORY TODAY
${batterHistory}

GAME STATS THIS GAME
${gameStats}
`.trim()
}

// ─── Main Claude call ─────────────────────────────────────────────────────────
export async function getClaudeRecommendations(context) {
  if (!canCallClaude()) return null
  lastCallTime = Date.now()

  const gameContext = buildGameContext(context)

  const prompt = `${gameContext}

You are a youth softball pitching coach assistant. Based on the situation above, provide:

1. TOP 3 PITCH RECOMMENDATIONS (ranked by confidence)
   For each: pitch type, target zone (row-col format like "3-2"), confidence % (15-95), and 2-3 bullet reasons

2. TOP 3 SIGNALS (most important things the coach should know right now)
   Each signal: type (info/warn/ok), and concise text (max 12 words)

Respond ONLY in this exact JSON format, no other text:
{
  "recommendations": [
    {"pitch": "FASTBALL", "zone": "3-2", "zoneName": "LOW · MID", "confidence": 72, "reasons": ["reason1", "reason2"]},
    {"pitch": "DROP", "zone": "3-3", "zoneName": "LOW · OUT", "confidence": 58, "reasons": ["reason1", "reason2"]},
    {"pitch": "CHANGEUP", "zone": "2-3", "zoneName": "MID · OUT", "confidence": 45, "reasons": ["reason1"]}
  ],
  "signals": [
    {"type": "warn", "text": "Batter has seen 3 fastballs — change look"},
    {"type": "info", "text": "First pitch — attack zone, get ahead early"},
    {"type": "ok", "text": "Drop working well today at 70% strikes"}
  ]
}`

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) return null

    const data = await response.json()
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    // Validate shape
    if (!parsed.recommendations || !parsed.signals) return null
    return parsed
  } catch (e) {
    console.warn('Claude API call failed, using rule-based fallback:', e.message)
    return null
  }
}
