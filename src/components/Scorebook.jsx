import { useMemo } from 'react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  void:   '#050C14', panel:  '#0C1C2E', border: '#1A3550',
  gold:   '#F5A623', cyan:   '#00D4FF', green:  '#00E5A0',
  red:    '#FF4D6A', amber:  '#FFB347', purple: '#a78bfa',
  dimTxt: '#3D6080', secTxt: '#7BACC8', priTxt: '#E8F4FF',
}

const PITCH_COLORS = {
  Fastball:'#00D4FF', Changeup:'#00E5A0', Drop:'#F5A623',
  Rise:'#FF4D6A', Curve:'#a78bfa', Screw:'#FFB347', 'Drop-Curve':'#F5A623',
}
const PITCH_SHORT = {
  Fastball:'FB', Changeup:'CH', Drop:'DP', Rise:'RS', Curve:'CV', Screw:'SC', 'Drop-Curve':'DC',
}
const OUTCOME_BG = {
  B:'rgba(0,212,255,0.14)', CK:'rgba(255,77,106,0.18)', SK:'rgba(255,77,106,0.18)',
  F:'rgba(255,179,71,0.14)', IP:'rgba(0,229,160,0.14)', HBP:'rgba(167,139,250,0.14)',
}
const OUTCOME_BORDER = {
  B:'rgba(0,212,255,0.3)', CK:'rgba(255,77,106,0.35)', SK:'rgba(255,77,106,0.35)',
  F:'rgba(255,179,71,0.3)', IP:'rgba(0,229,160,0.3)', HBP:'rgba(167,139,250,0.3)',
}
const OUTCOME_LETTER = { B:'B', CK:'K', SK:'S', F:'F', IP:'●', HBP:'H' }
const OUTCOME_COLOR  = { B:C.cyan, CK:C.red, SK:C.red, F:C.amber, IP:C.green, HBP:C.purple }
const RESULT_STYLE = {
  'Swing K':  [C.red,   'rgba(255,77,106,0.15)'],
  'Called K': [C.red,   'rgba(255,77,106,0.15)'],
  'Walk':     [C.cyan,  'rgba(0,212,255,0.12)'],
  'HBP':      [C.purple,'rgba(167,139,250,0.15)'],
  'Single':   [C.green, 'rgba(0,229,160,0.12)'],
  'Double':   [C.green, 'rgba(0,229,160,0.12)'],
  'Triple':   [C.green, 'rgba(0,229,160,0.12)'],
  'Home Run': [C.gold,  'rgba(245,166,35,0.15)'],
  'Groundout':[C.secTxt,'rgba(61,96,128,0.15)'],
  'Flyout':   [C.secTxt,'rgba(61,96,128,0.15)'],
  'Lineout':  [C.secTxt,'rgba(61,96,128,0.15)'],
}

const mono = "'Share Tech Mono', monospace"
const bebas = "'Bebas Neue', 'Rajdhani', sans-serif"
const sans  = "'DM Sans', sans-serif"

// ── Shared column template ────────────────────────────────────────────────────
const COLS = '150px repeat(7, 1fr) 60px'

// ── Pitch box ─────────────────────────────────────────────────────────────────
function PitchBox({ pitch, num }) {
  if (!pitch) return (
    <div style={{
      background:'rgba(255,255,255,0.02)',
      border:'1px solid rgba(255,255,255,0.03)',
      borderRadius:2, aspectRatio:'1',
    }}/>
  )

  const bg     = OUTCOME_BG[pitch.outcome_basic]    || 'rgba(255,255,255,0.04)'
  const border = OUTCOME_BORDER[pitch.outcome_basic] || 'rgba(255,255,255,0.07)'
  const letter = OUTCOME_LETTER[pitch.outcome_basic] || '?'
  const lcolor = OUTCOME_COLOR[pitch.outcome_basic]  || C.secTxt
  const dot    = PITCH_COLORS[pitch.pitch_type]      || C.secTxt
  const zone   = pitch.zone_row && pitch.zone_col ? `${pitch.zone_row}-${pitch.zone_col}` : ''

  const tip = [
    `${num}. ${pitch.pitch_type || '?'}`,
    zone ? `Zone ${zone}` : '',
    pitch.outcome_basic === 'B'   ? 'Ball'
    : pitch.outcome_basic === 'CK'? 'Called Strike'
    : pitch.outcome_basic === 'SK'? 'Swing & Miss'
    : pitch.outcome_basic === 'F' ? 'Foul'
    : pitch.outcome_basic === 'IP'? (pitch.outcome_inplay || 'In Play')
    : pitch.outcome_basic || '',
    `Count: ${pitch.balls_before ?? '?'}-${pitch.strikes_before ?? '?'}`,
  ].filter(Boolean).join(' · ')

  return (
    <div
      title={tip}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 2,
        aspectRatio: '1',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        minWidth: 0, minHeight: 0,
      }}
    >
      {/* Pitch type dot — top right */}
      <div style={{
        position:'absolute', top:2, right:2,
        width:4, height:4, borderRadius:'50%',
        background: dot, flexShrink:0,
      }}/>
      {/* Outcome letter */}
      <span style={{
        fontFamily: mono, fontSize:8, fontWeight:'bold',
        color: lcolor, lineHeight:1,
      }}>{letter}</span>
      {/* Zone — bottom left */}
      {zone && (
        <span style={{
          position:'absolute', bottom:1, left:2,
          fontFamily: mono, fontSize:'5px',
          color:'rgba(255,255,255,0.22)', lineHeight:1,
        }}>{zone}</span>
      )}
    </div>
  )
}

// ── AB cell ───────────────────────────────────────────────────────────────────
function ABCell({ pitches, isLive, isEmpty }) {
  if (isEmpty) return (
    <div style={{
      borderRight:`1px solid ${C.border}`,
      background:'rgba(0,0,0,0.1)',
    }}/>
  )

  const n    = pitches?.length || 0
  const last = pitches?.[n - 1]
  const slots = Array.from({ length:10 }, (_, i) => pitches?.[i] || null)

  let label = ''
  if (last) {
    if      (last.outcome_basic === 'CK') label = 'Called K'
    else if (last.outcome_basic === 'SK') label = 'Swing K'
    else if (last.outcome_basic === 'B')  label = 'Walk'
    else if (last.outcome_basic === 'HBP') label = 'HBP'
    else if (last.outcome_basic === 'IP')  label = last.outcome_inplay || 'In Play'
  }

  const rs = RESULT_STYLE[label] || [C.secTxt, 'rgba(61,96,128,0.15)']

  return (
    <div style={{
      borderRight: `1px solid ${C.border}`,
      padding: '4px 3px 3px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      background: isLive ? 'rgba(245,166,35,0.03)' : 'transparent',
      outline: isLive ? '1px solid rgba(245,166,35,0.2)' : 'none',
      outlineOffset: -1,
    }}>
      {/* 5×2 pitch grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5,1fr)',
        gridTemplateRows: 'repeat(2,1fr)',
        gap: 2,
        flex: 1,
      }}>
        {slots.map((p, i) => <PitchBox key={i} pitch={p} num={i+1} />)}
      </div>

      {/* Footer: result + pitch count */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1px' }}>
        {label ? (
          <span style={{
            fontFamily: mono, fontSize:'6.5px', letterSpacing:'0.5px',
            padding:'1px 5px', borderRadius:3,
            background: rs[1], color: rs[0],
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            maxWidth:'72%',
          }}>{label}</span>
        ) : isLive && n === 0 ? (
          <span style={{ fontFamily:mono, fontSize:'7px', color:'rgba(245,166,35,0.45)', letterSpacing:1 }}>LIVE</span>
        ) : null}
        {n > 0 && (
          <span style={{ fontFamily:mono, fontSize:'6.5px', color:C.dimTxt }}>{n}P</span>
        )}
      </div>
    </div>
  )
}

// ── Main Scorebook ────────────────────────────────────────────────────────────
export default function Scorebook({ gamePitches, lineup, pitcher, inning, topBottom, session }) {
  const INNINGS = 7
  const innNums = Array.from({ length:INNINGS }, (_,i) => i+1)

  // Group pitches by batter name → inning
  const byBatterInning = useMemo(() => {
    const map = {}
    gamePitches.forEach(p => {
      const key = p.batter_name || 'Unknown'
      if (!map[key]) map[key] = {}
      if (!map[key][p.inning]) map[key][p.inning] = []
      map[key][p.inning].push(p)
    })
    Object.values(map).forEach(bi =>
      Object.keys(bi).forEach(i => bi[i].sort((a,b)=>(a.pitch_id||0)-(b.pitch_id||0)))
    )
    return map
  }, [gamePitches])

  // Per-inning stats
  const innStats = useMemo(() => {
    const s = {}
    innNums.forEach(i => {
      const ps = gamePitches.filter(p => p.inning === i)
      const sk = ps.filter(p => ['CK','SK','F'].includes(p.outcome_basic)).length
      s[i] = { count:ps.length, rate: ps.length > 0 ? Math.round(sk/ps.length*100) : null }
    })
    return s
  }, [gamePitches])

  const total     = gamePitches.length
  const totalK    = gamePitches.filter(p => ['CK','SK','F'].includes(p.outcome_basic)).length
  const totalRate = total > 0 ? Math.round(totalK/total*100) : null

  const rateColor = r => r === null ? C.dimTxt : r >= 65 ? C.green : r >= 55 ? C.amber : C.red

  // Batters — use lineup order if available, else derive from pitch data
  const batters = useMemo(() => {
    if (lineup?.length > 0) return lineup
    const seen = [], names = new Set()
    gamePitches.forEach(p => {
      if (p.batter_name && !names.has(p.batter_name)) {
        names.add(p.batter_name)
        seen.push({ name:p.batter_name, jersey:'', batter_type:'unknown', lineup_order:seen.length+1 })
      }
    })
    return seen
  }, [lineup, gamePitches])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:C.void, overflow:'hidden', fontFamily:sans }}>

      {/* ── Game header ──────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 16px', background:C.panel, borderBottom:`1px solid ${C.border}`,
        flexShrink:0,
      }}>
        <div>
          <div style={{ fontFamily:bebas, fontSize:18, letterSpacing:3, color:C.gold }}>PITCH SCOREBOOK</div>
          <div style={{ fontFamily:mono, fontSize:9, letterSpacing:2, color:C.secTxt, marginTop:2 }}>
            {session?.team?.name} · vs {session?.game?.opponent} · {session?.game?.game_date}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:bebas, fontSize:26, color:C.priTxt, lineHeight:1 }}>{total}</div>
            <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dimTxt }}>PITCHES</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:bebas, fontSize:26, color:rateColor(totalRate), lineHeight:1 }}>
              {totalRate !== null ? `${totalRate}%` : '—'}
            </div>
            <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dimTxt }}>STRIKE %</div>
          </div>
          {pitcher && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:mono, fontSize:10, color:C.green }}>⚾ {pitcher.name}</div>
              <div style={{ fontFamily:mono, fontSize:7, letterSpacing:1, color:C.dimTxt, marginTop:2 }}>
                {(pitcher.pitching_style||'').toUpperCase()} · {pitcher.throws||'R'}HP
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', flexWrap:'wrap', gap:10,
        padding:'5px 16px', background:'rgba(255,255,255,0.01)',
        borderBottom:`1px solid ${C.border}`, flexShrink:0,
      }}>
        <span style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dimTxt }}>PITCH</span>
        {Object.entries(PITCH_SHORT).map(([name, short]) => (
          <div key={name} style={{ display:'flex', alignItems:'center', gap:3, fontFamily:mono, fontSize:8, color:C.secTxt }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:PITCH_COLORS[name] }}/>
            {short}={name}
          </div>
        ))}
        <div style={{ width:1, height:14, background:C.border, margin:'0 4px' }}/>
        <span style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dimTxt }}>OUTCOME</span>
        {[['B','Ball',C.cyan,'rgba(0,212,255,0.15)'],['K','Strike',C.red,'rgba(255,77,106,0.15)'],['F','Foul',C.amber,'rgba(255,179,71,0.15)'],['●','In Play',C.green,'rgba(0,229,160,0.15)']].map(([l,lbl,c,bg])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:3, fontFamily:mono, fontSize:8, color:C.secTxt }}>
            <div style={{ width:14, height:9, borderRadius:2, background:bg }}/>
            {l}={lbl}
          </div>
        ))}
        <div style={{ width:1, height:14, background:C.border, margin:'0 4px' }}/>
        <span style={{ fontFamily:mono, fontSize:7, color:C.dimTxt, opacity:0.7 }}>DOT=PITCH TYPE · HOVER FOR DETAIL</span>
      </div>

      {/* ── Scrollable grid ───────────────────────────────────── */}
      <div style={{ flex:1, overflow:'auto' }}>
        <div style={{ minWidth:920 }}>

          {/* Column headers */}
          <div style={{
            display:'grid', gridTemplateColumns:COLS,
            background:C.panel, borderBottom:`2px solid ${C.border}`,
            position:'sticky', top:0, zIndex:10,
          }}>
            <div style={{ padding:'8px 10px', fontFamily:mono, fontSize:8, letterSpacing:2, color:C.dimTxt, borderRight:`1px solid ${C.border}`, display:'flex', alignItems:'center' }}>
              BATTER
            </div>
            {innNums.map(i => {
              const isLive = i === inning
              const isPast = i < inning
              return (
                <div key={i} style={{
                  padding:'6px 4px', textAlign:'center',
                  borderRight:`1px solid ${C.border}`,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                  background: isLive ? 'rgba(245,166,35,0.07)' : 'transparent',
                  opacity: !isPast && !isLive ? 0.35 : 1,
                }}>
                  <div style={{ fontFamily:bebas, fontSize:22, lineHeight:1, color: isLive ? C.gold : isPast ? C.priTxt : C.dimTxt }}>{i}</div>
                  <div style={{ fontFamily:mono, fontSize:7, letterSpacing:1, color: isLive ? C.gold : C.dimTxt }}>
                    {isLive ? '▲ LIVE' : isPast ? '▲ TOP' : '—'}
                  </div>
                </div>
              )
            })}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:7, letterSpacing:1, color:C.dimTxt }}>
              TOTALS
            </div>
          </div>

          {/* Pitcher strip */}
          {pitcher && (
            <div style={{
              display:'grid', gridTemplateColumns:COLS,
              background:'rgba(0,229,160,0.04)',
              borderTop:`1px solid rgba(0,229,160,0.12)`,
              borderBottom:`1px solid rgba(0,229,160,0.12)`,
            }}>
              <div style={{
                padding:'5px 10px', display:'flex', alignItems:'center', gap:6,
                fontFamily:mono, fontSize:8, letterSpacing:1, color:C.green,
                borderRight:`1px solid ${C.border}`,
              }}>
                <span>⚾</span>
                <span>{pitcher.name}{pitcher.jersey ? ` #${pitcher.jersey}` : ''} — {(pitcher.pitching_style||'').toUpperCase()} {pitcher.throws||'R'}HP</span>
              </div>
              <div style={{ gridColumn:'span 8', padding:'5px 12px', display:'flex', alignItems:'center', gap:14, borderLeft:`1px solid ${C.border}` }}>
                {(pitcher.pitcher_arsenal||[]).map(p => (
                  <span key={p} style={{ fontFamily:mono, fontSize:8, letterSpacing:1, color: PITCH_COLORS[p]||C.secTxt }}>
                    ● {p}{pitcher.pitch_speeds?.[p] ? ` ${pitcher.pitch_speeds[p]}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Batter rows */}
          {batters.map((batter, idx) => {
            const byInn    = byBatterInning[batter.name] || {}
            const allP     = gamePitches.filter(p => p.batter_name === batter.name)
            const ks       = allP.filter(p => ['CK','SK'].includes(p.outcome_basic)).length
            const hits     = allP.filter(p => p.outcome_basic === 'IP' && ['Single','Double','Triple','Home Run'].includes(p.outcome_inplay)).length
            const hasPitch = allP.length > 0
            const bt       = (batter.batter_type || 'unknown').toLowerCase()
            const typeColor = bt==='power' ? C.red : bt==='contact' ? C.cyan : bt==='slapper' ? C.green : C.dimTxt

            return (
              <div key={batter.name||idx} style={{
                display:'grid', gridTemplateColumns:COLS,
                borderBottom:`1px solid ${C.border}`,
                minHeight:80,
              }}>

                {/* Batter info */}
                <div style={{
                  padding:'6px 8px', borderRight:`1px solid ${C.border}`,
                  display:'flex', alignItems:'center', gap:6,
                  background:'rgba(255,255,255,0.01)',
                  position:'sticky', left:0, zIndex:5,
                }}>
                  <span style={{ fontFamily:mono, fontSize:10, color:C.dimTxt, width:14, textAlign:'center', flexShrink:0 }}>
                    {batter.lineup_order || idx+1}
                  </span>
                  <span style={{ fontFamily:mono, fontSize:9, color:C.gold, width:22, textAlign:'center', flexShrink:0 }}>
                    #{batter.jersey||'—'}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:C.priTxt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {batter.name}
                    </div>
                    <div style={{ fontFamily:mono, fontSize:7, letterSpacing:1, color:typeColor, marginTop:2 }}>
                      {bt.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* AB cells per inning */}
                {innNums.map(inn => {
                  const pitches = byInn[inn] || []
                  const isLive  = inn === inning
                  const isEmpty = inn > inning || (inn <= inning && pitches.length === 0 && !isLive)
                  return (
                    <ABCell
                      key={inn}
                      pitches={pitches.length > 0 ? pitches : null}
                      isLive={isLive}
                      isEmpty={isEmpty && !isLive}
                    />
                  )
                })}

                {/* Totals */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:4 }}>
                  {hasPitch ? (
                    <>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:bebas, fontSize:16, color:C.priTxt, lineHeight:1 }}>{allP.length}</div>
                        <div style={{ fontFamily:mono, fontSize:6, color:C.dimTxt, letterSpacing:1 }}>PIT</div>
                      </div>
                      {ks  > 0 && <div style={{ fontFamily:bebas, fontSize:14, color:C.red,   lineHeight:1 }}>{ks}K</div>}
                      {hits > 0 && <div style={{ fontFamily:bebas, fontSize:14, color:C.green, lineHeight:1 }}>{hits}H</div>}
                    </>
                  ) : (
                    <span style={{ color:C.dimTxt, fontSize:12 }}>—</span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Summary rows */}
          {[
            ['PITCHES / INN', innNums.map(i => innStats[i]?.count || null), total, C.gold],
            ['STRIKE %',      innNums.map(i => innStats[i]?.rate !== null && innStats[i]?.rate !== undefined ? `${innStats[i].rate}%` : null), totalRate !== null ? `${totalRate}%` : null, null],
          ].map(([label, vals, totalVal, forceColor]) => (
            <div key={label} style={{
              display:'grid', gridTemplateColumns:COLS,
              background:C.panel, borderTop:`1px solid ${C.border}`,
            }}>
              <div style={{ padding:'6px 10px', fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dimTxt, borderRight:`1px solid ${C.border}`, display:'flex', alignItems:'center' }}>
                {label}
              </div>
              {vals.map((val, i) => (
                <div key={i} style={{ borderRight:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}>
                  <span style={{ fontFamily:bebas, fontSize:17, lineHeight:1, color: forceColor || rateColor(innStats[i+1]?.rate) }}>
                    {val ?? '—'}
                  </span>
                </div>
              ))}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}>
                <span style={{ fontFamily:bebas, fontSize:17, lineHeight:1, color: forceColor || rateColor(totalRate) }}>
                  {totalVal ?? '—'}
                </span>
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
