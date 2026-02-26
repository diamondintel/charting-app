import { useState } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const C = {
  bg:    '#050C14', panel: '#0C1C2E', border: '#1A3550',
  pri:   '#E8F4F8', sec:   '#7BACC8', dim:   '#3D6080',
  gold:  '#F5A623', cyan:  '#00D4FF', green: '#00E5A0',
  red:   '#FF5050', amber: '#F59E0B', purple:'#A78BFA',
}
const mono  = "'Share Tech Mono', monospace"
const sans  = "'DM Sans', sans-serif"
const bebas = "'Bebas Neue', 'Rajdhani', sans-serif"

const ZONE_LABELS = {
  '1-1':'HI-IN','1-2':'HI-MID','1-3':'HI-OUT',
  '2-1':'MID-IN','2-2':'MID-MID','2-3':'MID-OUT',
  '3-1':'LO-IN','3-2':'LO-MID','3-3':'LO-OUT',
}

function computeSummaryStats(gamePitches, allPAs, pitcherName, oppLineup) {
  const pitches   = gamePitches.filter(p => p.pitcher_name === pitcherName)
  const total     = pitches.length
  const strikes   = pitches.filter(p => ['CK','SK','F','IP'].includes(p.outcome_basic)).length
  const balls     = pitches.filter(p => p.outcome_basic === 'B').length
  const ks        = allPAs.filter(p => ['CK','SK'].includes(p.pa_result)).length
  const strikeRate = total > 0 ? Math.round(strikes / total * 100) : 0
  const firstPitch = pitches.filter((p,i,arr) => {
    // first pitch of each PA = pitch where pa_pitches count resets
    const prev = arr[i-1]
    return !prev || prev.pa_id !== p.pa_id
  })
  const fps = firstPitch.length > 0
    ? Math.round(firstPitch.filter(p => ['CK','SK','F'].includes(p.outcome_basic)).length / firstPitch.length * 100)
    : 0

  // Pitch type breakdown
  const byType = {}
  pitches.forEach(p => {
    const t = p.pitch_type || 'Unknown'
    if (!byType[t]) byType[t] = { total:0, strikes:0 }
    byType[t].total++
    if (['CK','SK','F','IP'].includes(p.outcome_basic)) byType[t].strikes++
  })

  // Zone heatmap data — count pitches per zone
  const zoneMap = {}
  for (let r=1;r<=3;r++) for (let c=1;c<=3;c++) zoneMap[`${r}-${c}`] = { count:0, strikes:0 }
  pitches.forEach(p => {
    const z = p.pitch_zone
    if (z && zoneMap[z]) {
      zoneMap[z].count++
      if (['CK','SK','F','IP'].includes(p.outcome_basic)) zoneMap[z].strikes++
    }
  })

  // Per-batter breakdown
  const batters = {}
  allPAs.forEach(pa => {
    if (!batters[pa.batter_name]) batters[pa.batter_name] = { pa:0, k:0, hit:0, out:0, pitches:0 }
    batters[pa.batter_name].pa++
    if (['CK','SK'].includes(pa.pa_result)) batters[pa.batter_name].k++
    else if (pa.pa_result === 'IP') {
      const ip = pa.outcome_inplay || ''
      if (['Single','Double','Triple','Home Run','Sac Fly'].includes(ip)) batters[pa.batter_name].hit++
      else batters[pa.batter_name].out++
    }
  })
  gamePitches.forEach(p => {
    if (batters[p.batter_name]) batters[p.batter_name].pitches++
  })

  // Sort batters by lineup order
  const batterList = Object.entries(batters).map(([name, s]) => {
    const player = oppLineup.find(p => p.name === name)
    return { name, ...s, order: player?.lineup_order ?? 99 }
  }).sort((a,b) => a.order - b.order)

  // AI coaching takeaways
  const takeaways = generateTakeaways({ total, strikeRate, fps, byType, batterList, ks, zoneMap })

  return { total, strikes, balls, ks, strikeRate, fps, byType, zoneMap, batterList, takeaways }
}

function generateTakeaways({ total, strikeRate, fps, byType, batterList, ks, zoneMap }) {
  const tips = []

  // Strike rate assessment
  if (strikeRate >= 65) tips.push(`Excellent command — ${strikeRate}% strike rate. Pitcher was consistently ahead in counts all game.`)
  else if (strikeRate >= 55) tips.push(`Solid control at ${strikeRate}% strikes. Focus on sustaining first-pitch strikes to reduce deep counts.`)
  else tips.push(`Strike rate was ${strikeRate}% — below target. Work on first-pitch strikes to avoid falling behind hitters.`)

  // First pitch strikes
  if (fps >= 60) tips.push(`First-pitch strike rate of ${fps}% is strong. Batters were consistently on defense early in counts.`)
  else tips.push(`First-pitch strikes at ${fps}% — getting ahead early will reduce pitch counts and tire hitters faster.`)

  // Dominant pitch
  const sorted = Object.entries(byType).sort((a,b) => b[1].total - a[1].total)
  if (sorted.length > 0) {
    const [topType, topData] = sorted[0]
    const topStr = Math.round(topData.strikes / topData.total * 100)
    tips.push(`${topType} was primary pitch (${topData.total} thrown, ${topStr}% strikes). ` +
      (topStr >= 65 ? `Very effective — lean on it in high-leverage counts.` :
       `Consider mixing secondary pitches to keep hitters off-balance.`))
  }

  // Most difficult batter
  const mostPitches = [...batterList].sort((a,b) => b.pitches - a.pitches)[0]
  if (mostPitches && mostPitches.pitches >= 5) {
    tips.push(`${mostPitches.name} saw ${mostPitches.pitches} pitches — most of any batter. Plan a quicker approach in next matchup.`)
  }

  // Hot zone
  const hotZone = Object.entries(zoneMap).filter(([,v]) => v.count >= 3).sort((a,b) => {
    const aStr = a[1].count > 0 ? a[1].strikes/a[1].count : 0
    const bStr = b[1].count > 0 ? b[1].strikes/b[1].count : 0
    return bStr - aStr
  })[0]
  if (hotZone) {
    const [zone, data] = hotZone
    const zStr = Math.round(data.strikes/data.count*100)
    tips.push(`Zone ${ZONE_LABELS[zone] || zone} was most effective (${zStr}% strikes on ${data.count} pitches). Target this zone vs similar hitters.`)
  }

  return tips.slice(0, 3)
}

// ─── Zone Heatmap Component ───────────────────────────────────────────────────
function ZoneHeatmap({ zoneMap }) {
  const maxCount = Math.max(...Object.values(zoneMap).map(z => z.count), 1)
  return (
    <div>
      <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:2, marginBottom:8 }}>PITCH ZONE HEATMAP</div>
      <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'center' }}>
        <div style={{ fontFamily:mono, fontSize:8, color:C.dim, marginBottom:2 }}>IN · MID · OUT</div>
        {[1,2,3].map(row => (
          <div key={row} style={{ display:'flex', gap:3 }}>
            {[1,2,3].map(col => {
              const z = zoneMap[`${row}-${col}`] || { count:0, strikes:0 }
              const intensity = z.count / maxCount
              const strRate = z.count > 0 ? z.strikes/z.count : 0
              const bg = z.count === 0
                ? 'rgba(255,255,255,0.03)'
                : `rgba(${strRate > 0.6 ? '0,229,160' : strRate > 0.4 ? '245,166,35' : '255,80,80'},${0.15 + intensity * 0.65})`
              return (
                <div key={col} style={{
                  width:64, height:52, background:bg,
                  border:`1px solid ${C.border}`, borderRadius:4,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                }}>
                  <div style={{ fontFamily:bebas, fontSize:18, color:C.pri, lineHeight:1 }}>{z.count}</div>
                  {z.count > 0 && <div style={{ fontFamily:mono, fontSize:7, color:C.dim }}>{Math.round(strRate*100)}%</div>}
                </div>
              )
            })}
          </div>
        ))}
        <div style={{ display:'flex', gap:12, marginTop:6 }}>
          {[['■ HIGH STR','#00E5A0'],['■ MED STR','#F5A623'],['■ LOW STR','#FF5050']].map(([l,c]) => (
            <span key={l} style={{ fontFamily:mono, fontSize:7, color:c }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main GameSummary Component ───────────────────────────────────────────────
export default function GameSummary({ session, gamePitches, allPAs, pitcherName, oppLineup, ourLineup, ourRuns, oppRuns, inning, onClose, onExportPDF }) {
  const [tab, setTab] = useState('overview')
  const opponent = session?.game?.opponent || 'Opponent'
  const teamName = session?.team?.name || 'Lady Hawks'
  const date = session?.game?.game_date ? new Date(session.game.game_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''

  const weWon = ourRuns > oppRuns
  const tied  = ourRuns === oppRuns
  const result = tied ? 'TIE' : weWon ? 'WIN' : 'LOSS'
  const resultColor = tied ? C.amber : weWon ? C.green : C.red

  const stats = computeSummaryStats(gamePitches, allPAs, pitcherName, oppLineup)
  const PITCH_COLORS = { Fastball:'#00D4FF', Drop:'#F5A623', Changeup:'#00E5A0', Rise:'#FF6B6B', Curve:'#A78BFA', Screwball:'#F59E0B', 'Drop-Curve':'#EC4899' }

  return (
    <div style={{ position:'fixed', inset:0, background:C.bg, zIndex:500, overflowY:'auto', fontFamily:sans }}>
      <div style={{ maxWidth:680, margin:'0 auto', padding:'16px 16px 100px' }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:3 }}>GAME SUMMARY · {date}</div>
            <div style={{ fontFamily:bebas, fontSize:13, color:C.sec, letterSpacing:2, marginTop:2 }}>{teamName}</div>
            <div style={{ fontFamily:bebas, fontSize:13, color:C.dim, letterSpacing:1 }}>vs {opponent}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onExportPDF} style={{ padding:'8px 14px', background:'rgba(245,166,35,0.12)', border:'1px solid rgba(245,166,35,0.35)', color:C.gold, borderRadius:4, cursor:'pointer', fontFamily:mono, fontSize:8, letterSpacing:1 }}>
              ↓ EXPORT PDF
            </button>
            <button onClick={onClose} style={{ padding:'8px 14px', background:'transparent', border:`1px solid ${C.border}`, color:C.sec, borderRadius:4, cursor:'pointer', fontFamily:mono, fontSize:8, letterSpacing:1 }}>
              ✕ CLOSE
            </button>
          </div>
        </div>

        {/* ── Score Banner ── */}
        <div style={{ padding:'20px 24px', background:C.panel, border:`2px solid ${resultColor}`, borderRadius:10, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:2, marginBottom:4 }}>{teamName.toUpperCase()}</div>
            <div style={{ fontFamily:bebas, fontSize:56, color:C.pri, lineHeight:1 }}>{ourRuns}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:bebas, fontSize:32, color:resultColor, letterSpacing:4 }}>{result}</div>
            <div style={{ fontFamily:mono, fontSize:8, color:C.dim }}>FINAL · INN {inning}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:2, marginBottom:4 }}>{opponent.toUpperCase()}</div>
            <div style={{ fontFamily:bebas, fontSize:56, color:C.pri, lineHeight:1 }}>{oppRuns}</div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:'flex', gap:4, marginBottom:14 }}>
          {[['overview','OVERVIEW'],['heatmap','ZONE MAP'],['batters','BATTERS'],['takeaways','COACHING']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'8px 0', borderRadius:4, cursor:'pointer',
              fontFamily:mono, fontSize:7, letterSpacing:2,
              background: tab===t ? 'rgba(0,212,255,0.12)' : 'transparent',
              border:`1px solid ${tab===t ? 'rgba(0,212,255,0.4)' : C.border}`,
              color: tab===t ? C.cyan : C.dim,
            }}>{l}</button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
              {[['PITCHES',stats.total,C.gold],['STRIKE%',`${stats.strikeRate}%`,stats.strikeRate>=60?C.green:C.amber],["K'S",stats.ks,C.cyan],['FPS%',`${stats.fps}%`,stats.fps>=60?C.green:C.amber]].map(([l,v,c]) => (
                <div key={l} style={{ textAlign:'center', padding:'10px 8px', background:C.panel, border:`1px solid ${C.border}`, borderRadius:6 }}>
                  <div style={{ fontFamily:bebas, fontSize:28, color:c, lineHeight:1 }}>{v}</div>
                  <div style={{ fontFamily:mono, fontSize:7, color:C.dim, letterSpacing:2, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'12px 14px', background:C.panel, border:`1px solid ${C.border}`, borderRadius:6 }}>
              <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:2, marginBottom:10 }}>PITCH ARSENAL</div>
              {Object.entries(stats.byType).sort((a,b)=>b[1].total-a[1].total).map(([type,data]) => {
                const pct = Math.round(data.total/stats.total*100)
                const strPct = Math.round(data.strikes/data.total*100)
                return (
                  <div key={type} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontFamily:mono, fontSize:9, color:C.sec }}>{type}</span>
                      <span style={{ fontFamily:mono, fontSize:9, color:C.dim }}>{data.total} · {pct}% usage · {strPct}% strikes</span>
                    </div>
                    <div style={{ height:5, background:C.border, borderRadius:3 }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:PITCH_COLORS[type]||C.sec, borderRadius:3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── HEATMAP ── */}
        {tab === 'heatmap' && (
          <div style={{ padding:'16px', background:C.panel, border:`1px solid ${C.border}`, borderRadius:6, display:'flex', justifyContent:'center' }}>
            <ZoneHeatmap zoneMap={stats.zoneMap} />
          </div>
        )}

        {/* ── BATTERS ── */}
        {tab === 'batters' && (
          <div style={{ padding:'12px 14px', background:C.panel, border:`1px solid ${C.border}`, borderRadius:6 }}>
            <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 36px 36px 36px 36px 52px', gap:6, marginBottom:8, paddingBottom:6, borderBottom:`1px solid ${C.border}` }}>
              {['#','BATTER','PA','K','H','OUT','PITCHES'].map(h => (
                <span key={h} style={{ fontFamily:mono, fontSize:7, color:C.dim, letterSpacing:1 }}>{h}</span>
              ))}
            </div>
            {stats.batterList.map((b,i) => (
              <div key={b.name} style={{ display:'grid', gridTemplateColumns:'28px 1fr 36px 36px 36px 36px 52px', gap:6, padding:'6px 0', borderBottom:`1px solid rgba(26,53,80,0.5)`, alignItems:'center' }}>
                <span style={{ fontFamily:bebas, fontSize:14, color:C.dim }}>{b.order||i+1}</span>
                <span style={{ fontFamily:sans, fontSize:12, color:C.pri, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.name}</span>
                <span style={{ fontFamily:bebas, fontSize:16, color:C.gold, textAlign:'center' }}>{b.pa}</span>
                <span style={{ fontFamily:bebas, fontSize:16, color:b.k>0?C.cyan:C.dim, textAlign:'center' }}>{b.k}</span>
                <span style={{ fontFamily:bebas, fontSize:16, color:b.hit>0?C.green:C.dim, textAlign:'center' }}>{b.hit}</span>
                <span style={{ fontFamily:bebas, fontSize:16, color:C.sec, textAlign:'center' }}>{b.out}</span>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ flex:1, height:3, background:C.border, borderRadius:2 }}>
                    <div style={{ height:'100%', width:`${Math.min(b.pitches/12*100,100)}%`, background:b.pitches>=8?C.red:C.amber, borderRadius:2 }} />
                  </div>
                  <span style={{ fontFamily:mono, fontSize:8, color:C.dim, minWidth:14 }}>{b.pitches}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── COACHING TAKEAWAYS ── */}
        {tab === 'takeaways' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {stats.takeaways.map((tip,i) => (
              <div key={i} style={{ padding:'14px 16px', background:C.panel, border:`1px solid ${i===0?'rgba(0,212,255,0.35)':C.border}`, borderRadius:8, display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ fontFamily:bebas, fontSize:28, color:i===0?C.cyan:C.dim, lineHeight:1, minWidth:24, textAlign:'center' }}>0{i+1}</div>
                <div style={{ fontFamily:sans, fontSize:13, color:C.pri, lineHeight:1.6 }}>{tip}</div>
              </div>
            ))}
            <div style={{ padding:'12px 16px', background:'rgba(245,166,35,0.06)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:6 }}>
              <div style={{ fontFamily:mono, fontSize:7, color:C.gold, letterSpacing:2, marginBottom:4 }}>NEXT MATCHUP vs {opponent.toUpperCase()}</div>
              <div style={{ fontFamily:sans, fontSize:12, color:C.sec, lineHeight:1.5 }}>
                Review batter heat zones before next game. Focus on reducing pitch count vs batters who saw 7+ pitches today.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
