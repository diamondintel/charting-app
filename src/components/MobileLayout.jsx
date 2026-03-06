import React, { useState } from 'react'

// ── Bottom tab bar for mobile ─────────────────────────────────────────────────
const TABS = [
  { id: 'pitch',  icon: '⚾', label: 'PITCH'  },
  { id: 'ai',     icon: '🤖', label: 'AI'     },
  { id: 'game',   icon: '📊', label: 'GAME'   },
  { id: 'book',   icon: '≡',  label: 'BOOK'   },
]

const mono  = "'Share Tech Mono', monospace"
const bebas = "'Bebas Neue', 'Rajdhani', sans-serif"
const sans  = "'DM Sans', sans-serif"
const C = {
  void:'#050C14', panel:'#0C1C2E', border:'#1A3550',
  gold:'#F5A623', cyan:'#00D4FF', green:'#00E5A0',
  red:'#FF4D6A', amber:'#FFB347', purple:'#a78bfa',
  dim:'#3D6080', sec:'#7BACC8', pri:'#E8F4FF',
}

const PITCH_COLORS = {
  Fastball:'#00D4FF', Changeup:'#00E5A0', Drop:'#F5A623',
  Rise:'#FF4D6A', Curve:'#a78bfa', Screw:'#FFB347', 'Drop-Curve':'#F5A623',
}
const OUTCOME_COLORS_MAP = {
  B:   { color:C.cyan,   label:'BALL'     },
  CK:  { color:C.red,    label:'CALLED K' },
  SK:  { color:C.red,    label:'SWING K'  },
  F:   { color:C.amber,  label:'FOUL'     },
  IP:  { color:C.green,  label:'IN PLAY'  },
  HBP: { color:C.purple, label:'HBP'      },
}
const OUTCOMES = [
  { code:'B',   label:'BALL'     },
  { code:'CK',  label:'CALLED K' },
  { code:'SK',  label:'SWING K'  },
  { code:'F',   label:'FOUL'     },
  { code:'IP',  label:'IN PLAY'  },
  { code:'HBP', label:'HBP'      },
]
const INPLAY_RESULTS = ['Single','Double','Triple','Home Run','Groundout','Flyout','Lineout','Popout','Sac Fly','Fielder Choice','Double Play','DP (FC)','Error']
const FOUL_LOCATIONS = ['Bunt Foul','Pull Foul','Oppo Foul','Deep L Foul','Deep R Foul','Back Screen']
const FIELDERS = ['P','C','1B','2B','3B','SS','LF','CF','RF']
const LOCATIONS = ['Infield','Left','Center','Right','Deep L','Deep C','Deep R']

// ── PITCH TAB ─────────────────────────────────────────────────────────────────

const QUICK_TAGS = ['Struggling', 'Hot streak', 'Bunting', 'Pull hitter', 'Injured', 'Slumping', 'Watch speed']

function HitterNotePanel({ batter, note, onSave, colors: C }) {
  const [expanded, setExpanded] = React.useState(false)
  const [draft, setDraft] = React.useState(note)
  const mono = "'Share Tech Mono', monospace"
  const sans = "'DM Sans', sans-serif"

  // sync if batter changes
  React.useEffect(() => { setDraft(note); setExpanded(false) }, [batter?.name])

  function toggleTag(tag) {
    const tags = draft.tags.includes(tag)
      ? draft.tags.filter(t => t !== tag)
      : [...draft.tags, tag]
    const next = { ...draft, tags }
    setDraft(next)
    onSave(next)
  }

  function handleTextBlur(e) {
    const next = { ...draft, text: e.target.value }
    setDraft(next)
    onSave(next)
  }

  const hasContent = draft.tags.length > 0 || draft.text?.trim()

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'transparent',
          border: `1px solid ${hasContent ? 'rgba(245,166,35,0.4)' : C.border}`,
          borderRadius: 4, padding: '6px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: 2, color: hasContent ? '#F5A623' : C.dim }}>
          {hasContent ? `NOTES · ${draft.tags.length > 0 ? draft.tags.join(', ') : draft.text.slice(0,30)} ` : 'ADD NOTES'}
        </span>
        <span style={{ color: C.dim, fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{
          marginTop: 4, padding: '10px', background: 'rgba(245,166,35,0.06)',
          border: '1px solid rgba(245,166,35,0.25)', borderRadius: 4,
        }}>
          {/* Quick tags */}
          <div style={{ fontFamily: mono, fontSize: 7, color: C.dim, letterSpacing: 2, marginBottom: 6 }}>QUICK TAGS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {QUICK_TAGS.map(tag => {
              const active = draft.tags.includes(tag)
              return (
                <button key={tag} onClick={() => toggleTag(tag)} style={{
                  padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 10,
                  fontFamily: sans, fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(245,166,35,0.2)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(245,166,35,0.6)' : C.border}`,
                  color: active ? '#F5A623' : C.dim,
                }}>
                  {tag}
                </button>
              )
            })}
          </div>

          {/* Free text */}
          <div style={{ fontFamily: mono, fontSize: 7, color: C.dim, letterSpacing: 2, marginBottom: 4 }}>NOTES</div>
          <textarea
            defaultValue={draft.text}
            onBlur={handleTextBlur}
            placeholder="e.g. Likes outside drop, struggles high heat..."
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}`,
              borderRadius: 4, padding: '6px 8px', resize: 'none',
              color: C.pri, fontFamily: sans, fontSize: 11, lineHeight: 1.4,
            }}
          />
        </div>
      )}
    </div>
  )
}

function PitchTab({
  selectedZone, onSelectZone, selectedPitch, onSelectPitch,
  arsenal, recommendations, selectedOutcome, onSelectOutcome,
  inPlayDetail, onInPlayChange, onRecord, onUndo, canRecord, canUndo,
  balls, strikes, paPitches, currentBatter,
  outs, on1b, on2b, on3b, inning, topBottom,
  batterStats, pitcherName, gamePitches,
}) {
  const aiRecZones = new Set(recommendations.map(r => r.zone))
  const ZONE_ROWS = ['HIGH','MID','LOW']
  const ZONE_COLS = ['IN','MID','OUT']
  const showInPlay = selectedOutcome === 'IP'
  const upd = (k,v) => onInPlayChange({ ...inPlayDetail, [k]: v })

  return (
    <div style={{ flex:1, overflow:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>

      {/* ── HITTER CARD ── */}
      {(() => {
        const bt = (currentBatter?.batter_type || 'unknown').toLowerCase()
        const typeColor = bt==='power' ? C.red : bt==='contact' ? C.cyan : bt==='slapper' ? C.green : C.sec
        const hasStats = currentBatter && batterStats && batterStats.paToday > 0
        const isPhone = window.innerWidth < 500
        return isPhone ? (
          // ── PHONE: single compact row ──
          <div style={{ background:C.panel, borderRadius:6, border:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8, padding:'7px 10px' }}>
            <div style={{ width:3, height:28, borderRadius:2, background:typeColor, flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontFamily:bebas, fontSize:13, color:C.gold }}>{currentBatter ? `#${currentBatter.jersey}` : '—'}</span>
                <span style={{ fontSize:13, fontWeight:700, color: currentBatter ? C.pri : C.dim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {currentBatter?.name || 'Select batter in GAME tab'}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:1 }}>
                {hasStats && <span style={{ fontFamily:bebas, fontSize:13, color:C.pri }}>{batterStats.hits}-{batterStats.abs}</span>}
                {hasStats && batterStats.strikeouts > 0 && <span style={{ fontFamily:mono, fontSize:8, color:C.red }}>{batterStats.strikeouts}K</span>}
                {hasStats && batterStats.walks > 0 && <span style={{ fontFamily:mono, fontSize:8, color:C.cyan }}>{batterStats.walks}BB</span>}
                {!hasStats && <span style={{ fontFamily:mono, fontSize:7, color:C.dim }}>{currentBatter ? bt.toUpperCase() : 'NO BATTER'}</span>}
              </div>
            </div>
            <div style={{ textAlign:'center', flexShrink:0, background:'rgba(245,166,35,0.07)', border:`1px solid rgba(245,166,35,0.2)`, borderRadius:5, padding:'3px 8px' }}>
              <div style={{ fontFamily:bebas, fontSize:26, color:C.gold, lineHeight:1 }}>{balls}-{strikes}</div>
              <div style={{ fontFamily:mono, fontSize:6, color:C.dim, letterSpacing:1 }}>B·S</div>
            </div>
          </div>
        ) : (
          // ── TABLET: full card ──
          <div style={{ background:C.panel, borderRadius:8, border:`1px solid ${C.border}`, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, flexShrink:0 }}>
                <div style={{ width:4, height:32, borderRadius:2, background:typeColor }}/>
                <span style={{ fontFamily:bebas, fontSize:11, color:typeColor, letterSpacing:1 }}>
                  {bt==='power'?'PWR':bt==='contact'?'CON':bt==='slapper'?'SLP':'—'}
                </span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                {/* Name row */}
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ fontFamily:bebas, fontSize:16, color:C.gold }}>{currentBatter ? `#${currentBatter.jersey}` : '—'}</span>
                  <span style={{ fontSize:16, fontWeight:700, color: currentBatter ? C.pri : C.dim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {currentBatter?.name || 'Select batter in GAME tab'}
                  </span>
                </div>
                {/* Stats + AI rec row */}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3, flexWrap:'wrap' }}>
                  {hasStats ? (
                    <>
                      <span style={{ fontFamily:bebas, fontSize:18, color:C.pri, letterSpacing:1 }}>{batterStats.hits}-{batterStats.abs}</span>
                      {batterStats.strikeouts > 0 && <span style={{ fontFamily:mono, fontSize:9, color:C.red, background:'rgba(255,77,106,0.12)', padding:'1px 6px', borderRadius:4 }}>{batterStats.strikeouts}K</span>}
                      {batterStats.walks > 0 && <span style={{ fontFamily:mono, fontSize:9, color:C.cyan, background:'rgba(0,212,255,0.1)', padding:'1px 6px', borderRadius:4 }}>{batterStats.walks}BB</span>}
                      <span style={{ fontFamily:mono, fontSize:8, color:C.dim }}>{batterStats.paToday}PA</span>
                    </>
                  ) : (
                    <span style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:1 }}>
                      {currentBatter ? `${bt.toUpperCase()} · FIRST PA` : 'No batter selected'}
                    </span>
                  )}
                  {/* AI top recommendation */}
                  {recommendations?.[0] && (
                    <div style={{
                      display:'flex', alignItems:'center', gap:4,
                      marginLeft: hasStats ? 4 : 0,
                      background:'rgba(245,166,35,0.1)',
                      border:'1px solid rgba(245,166,35,0.35)',
                      borderRadius:5, padding:'2px 8px',
                    }}>
                      <span style={{ fontFamily:mono, fontSize:7, color:C.gold, letterSpacing:1 }}>★ AI</span>
                      <span style={{ fontFamily:bebas, fontSize:14, color:C.gold, letterSpacing:1 }}>
                        {recommendations[0].pitch}
                      </span>
                      <span style={{ fontFamily:mono, fontSize:7, color:C.sec }}>
                        {recommendations[0].zone || ''} · {recommendations[0].confidence}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* COUNT */}
              <div style={{ textAlign:'center', flexShrink:0, background:'rgba(245,166,35,0.07)', border:`1px solid rgba(245,166,35,0.2)`, borderRadius:6, padding:'4px 10px' }}>
                <div style={{ fontFamily:bebas, fontSize:34, color:C.gold, lineHeight:1, letterSpacing:2 }}>{balls}-{strikes}</div>
                <div style={{ fontFamily:mono, fontSize:7, color:C.dim, letterSpacing:2 }}>B · S</div>
              </div>
            </div>
            {/* TENDENCY TAGS */}
            {currentBatter?.batter_tendency && currentBatter.batter_tendency !== 'unknown' && (() => {
              const tags = currentBatter.batter_tendency
                .split(',')
                .map(t => t.trim().toLowerCase())
                .filter(t => t && t !== 'unknown' && t !== 'limited_data' && t !== 'low_ab_sample')
              return tags.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'0 12px 10px' }}>
                  {tags.map(tag => (
                    <span key={tag} style={{
                      fontFamily: mono,
                      fontSize: 8,
                      letterSpacing: 1,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: typeColor === C.red ? 'rgba(255,77,106,0.12)' : typeColor === C.cyan ? 'rgba(0,212,255,0.1)' : 'rgba(0,229,160,0.1)',
                      border: `1px solid ${typeColor === C.red ? 'rgba(255,77,106,0.35)' : typeColor === C.cyan ? 'rgba(0,212,255,0.35)' : 'rgba(0,229,160,0.35)'}`,
                      color: typeColor,
                      textTransform: 'uppercase',
                    }}>
                      {tag.replace(/_/g,' ')}
                    </span>
                  ))}
                </div>
              ) : null
            })()}
          </div>
        )
      })()}

      {/* Game state bar — outs + runners + inning */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
        gap:6,
      }}>
        {/* Outs */}
        <div style={{ padding: window.innerWidth < 500 ? '6px 8px' : '8px 10px', background:C.panel, borderRadius:6, border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', alignItems:'center', gap: window.innerWidth < 500 ? 3 : 4 }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim }}>OUTS</div>
          <div style={{ display:'flex', gap: window.innerWidth < 500 ? 4 : 5 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: window.innerWidth < 500 ? 12 : 14,
                height: window.innerWidth < 500 ? 12 : 14,
                borderRadius:'50%',
                border:`2px solid ${i < outs ? C.red : C.border}`,
                background: i < outs ? 'rgba(255,77,106,0.3)' : 'transparent',
              }}/>
            ))}
          </div>
        </div>

        {/* Runners mini diamond */}
        <div style={{ padding:'8px 10px', background:C.panel, borderRadius:6, border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim }}>RUNNERS</div>
          <div style={{ position:'relative', width:36, height:36 }}>
            {/* 2nd base — top center */}
            <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%) rotate(45deg)', width:12, height:12, border:`2px solid ${on2b ? C.gold : C.border}`, background: on2b ? 'rgba(245,166,35,0.4)' : 'transparent' }}/>
            {/* 3rd base — left */}
            <div style={{ position:'absolute', top:'50%', left:0, transform:'translateY(-50%) rotate(45deg)', width:12, height:12, border:`2px solid ${on3b ? C.gold : C.border}`, background: on3b ? 'rgba(245,166,35,0.4)' : 'transparent' }}/>
            {/* 1st base — right */}
            <div style={{ position:'absolute', top:'50%', right:0, transform:'translateY(-50%) rotate(45deg)', width:12, height:12, border:`2px solid ${on1b ? C.gold : C.border}`, background: on1b ? 'rgba(245,166,35,0.4)' : 'transparent' }}/>
            {/* Home — bottom center */}
            <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%) rotate(45deg)', width:10, height:10, border:`1px solid ${C.dim}`, background:'transparent' }}/>
          </div>
        </div>

        {/* Inning */}
        <div style={{ padding:'8px 10px', background:C.panel, borderRadius:6, border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim }}>INNING</div>
          <div style={{ fontFamily:bebas, fontSize:24, color:C.gold, lineHeight:1 }}>{inning}</div>
          <div style={{ fontFamily:mono, fontSize:8, color:C.gold, letterSpacing:1 }}>{topBottom === 'top' ? '▲ TOP' : '▼ BOT'}</div>
        </div>
      </div>

      {/* Zone grid — big touch targets */}
      <div>
        <div style={{ fontFamily:mono, fontSize:8, letterSpacing:3, color:C.dim, marginBottom:6 }}>STRIKE ZONE</div>
        {/* Col headers */}
        <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 1fr 1fr 32px', gap:3, marginBottom:3 }}>
          <div/>
          {ZONE_COLS.map(c => <div key={c} style={{ textAlign:'center', fontFamily:mono, fontSize:8, color:C.dim }}>{c}</div>)}
          <div/>
        </div>
        {ZONE_ROWS.map((rowLabel, ri) => (
          <div key={ri} style={{ display:'grid', gridTemplateColumns:'32px 1fr 1fr 1fr 32px', gap:3, marginBottom:3 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:8, color:C.dim }}>{rowLabel}</div>
            {[1,2,3].map(ci => {
              const row = ri+1, col = ci
              const zKey = `${row}-${col}`
              const isSel = selectedZone?.row===row && selectedZone?.col===col
              const isRec = aiRecZones.has(zKey)
              const isHeart = row===2&&col===2
              return (
                <div
                  key={zKey}
                  onClick={() => onSelectZone({ row, col })}
                  style={{
                    height: 56,
                    borderRadius: 5,
                    border: `2px solid ${isSel ? C.gold : isRec ? 'rgba(245,166,35,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    background: isSel ? 'rgba(245,166,35,0.15)'
                      : row===1 ? 'rgba(255,77,106,0.07)'
                      : row===2 ? 'rgba(255,179,71,0.07)'
                      : 'rgba(0,229,160,0.07)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer', position:'relative',
                    flexDirection:'column', gap:2,
                  }}
                >
                  {isRec && !isSel && <span style={{ position:'absolute', top:2, right:4, fontSize:9, color:C.gold }}>★</span>}
                  {isHeart && !isSel && <span style={{ fontSize:10, color:'rgba(255,77,106,0.4)' }}>♥</span>}
                  <span style={{ fontFamily:mono, fontSize:9, color: isSel ? C.gold : C.dim }}>{row}•{col}</span>
                </div>
              )
            })}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:8, color:['rgba(255,77,106,0.3)','rgba(255,179,71,0.3)','rgba(0,229,160,0.3)'][ri] }}>
              {['HI','MID','LO'][ri]}
            </div>
          </div>
        ))}
      </div>

      {/* Pitch type — big pills */}
      <div>
        <div style={{ fontFamily:mono, fontSize:8, letterSpacing:3, color:C.dim, marginBottom:6 }}>PITCH TYPE</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
          {arsenal.map((pt, i) => {
            const color = PITCH_COLORS[pt] || C.sec
            const isSel = selectedPitch === pt
            const recIdx = recommendations.findIndex(r => r.pitch === pt.toUpperCase())
            return (
              <div
                key={pt}
                onClick={() => onSelectPitch(pt)}
                style={{
                  padding: '10px 6px',
                  borderRadius: 6,
                  border: `2px solid ${isSel ? color : 'rgba(255,255,255,0.08)'}`,
                  background: isSel ? `${color}18` : C.panel,
                  textAlign:'center', cursor:'pointer',
                }}
              >
                <div style={{ width:8, height:8, borderRadius:'50%', background: isSel ? color : 'rgba(255,255,255,0.2)', margin:'0 auto 4px' }}/>
                <div style={{ fontSize:11, fontWeight:600, color: isSel ? color : C.sec, fontFamily:sans }}>{pt}</div>
                {recIdx === 0 && <div style={{ fontFamily:mono, fontSize:7, color:C.gold, marginTop:2 }}>★ #1</div>}
                {recIdx > 0  && <div style={{ fontFamily:mono, fontSize:7, color:C.dim,  marginTop:2 }}>#{recIdx+1}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Outcome buttons */}
      <div>
        <div style={{ fontFamily:mono, fontSize:8, letterSpacing:3, color:C.dim, marginBottom:6 }}>OUTCOME</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
          {OUTCOMES.map(o => {
            const isSel = selectedOutcome === o.code
            const oc = OUTCOME_COLORS_MAP[o.code]
            return (
              <button
                key={o.code}
                onClick={() => onSelectOutcome(o.code)}
                style={{
                  padding: '12px 4px',
                  borderRadius: 6,
                  border: `2px solid ${isSel ? oc.color : 'rgba(255,255,255,0.08)'}`,
                  background: isSel ? `${oc.color}18` : C.panel,
                  color: isSel ? oc.color : C.sec,
                  fontFamily:mono, fontSize:10, letterSpacing:1,
                  cursor:'pointer',
                }}
              >{o.label}</button>
            )
          })}
        </div>
      </div>

      {/* B-014: Foul location picker */}
      {selectedOutcome === 'F' && (
        <div style={{ background:C.panel, border:`1px solid rgba(255,179,71,0.2)`, borderRadius:8, padding:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            <div style={{ fontFamily:mono, fontSize:8, letterSpacing:2, color:C.amber }}>FOUL LOCATION</div>
            {strikes === 2 && inPlayDetail.foul_location === 'Bunt Foul' && (
              <div style={{ fontFamily:mono, fontSize:8, color:C.red, background:'rgba(255,77,106,0.12)', border:'1px solid rgba(255,77,106,0.4)', borderRadius:4, padding:'2px 8px' }}>
                ⚠ BUNT FOUL · 2 STRIKES = OUT
              </div>
            )}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {FOUL_LOCATIONS.map(fl => (
              <button key={fl} onClick={() => upd('foul_location', inPlayDetail.foul_location === fl ? '' : fl)} style={{
                padding:'6px 10px', borderRadius:4, fontSize:11, cursor:'pointer', fontFamily:sans,
                border:`1px solid ${inPlayDetail.foul_location===fl ? C.amber : C.border}`,
                background: inPlayDetail.foul_location===fl ? 'rgba(255,179,71,0.12)' : 'transparent',
                color: inPlayDetail.foul_location===fl ? C.amber : C.sec,
              }}>{fl}</button>
            ))}
          </div>
        </div>
      )}

      {/* In-play detail */}
      {showInPlay && (
        <div style={{ background:C.panel, border:`1px solid rgba(0,229,160,0.2)`, borderRadius:8, padding:10 }}>
          <div style={{ fontFamily:mono, fontSize:8, letterSpacing:2, color:C.green, marginBottom:8 }}>IN PLAY — RESULT DETAIL</div>
          <div style={{ fontFamily:mono, fontSize:8, color:C.dim, marginBottom:4 }}>RESULT</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
            {INPLAY_RESULTS.map(r => (
              <button key={r} onClick={() => upd('outcome_inplay', r)} style={{
                padding:'6px 10px', borderRadius:4, fontSize:11, cursor:'pointer', fontFamily:sans,
                border:`1px solid ${inPlayDetail.outcome_inplay===r ? C.green : C.border}`,
                background: inPlayDetail.outcome_inplay===r ? 'rgba(0,229,160,0.12)' : 'transparent',
                color: inPlayDetail.outcome_inplay===r ? C.green : C.sec,
              }}>{r}</button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <div style={{ fontFamily:mono, fontSize:8, color:C.dim, marginBottom:4 }}>FIELDER</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                {FIELDERS.map(f => (
                  <button key={f} onClick={() => upd('fielder',f)} style={{
                    padding:'5px 8px', borderRadius:3, fontSize:11, cursor:'pointer',
                    border:`1px solid ${inPlayDetail.fielder===f ? C.cyan : C.border}`,
                    background: inPlayDetail.fielder===f ? 'rgba(0,212,255,0.1)' : 'transparent',
                    color: inPlayDetail.fielder===f ? C.cyan : C.sec, fontFamily:mono,
                  }}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily:mono, fontSize:8, color:C.dim, marginBottom:4 }}>RUNS SCORED</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={() => upd('runs_scored', Math.max(0, inPlayDetail.runs_scored-1))} style={{ width:32, height:32, borderRadius:4, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.05)', color:C.pri, fontSize:18, cursor:'pointer' }}>−</button>
                <span style={{ fontFamily:bebas, fontSize:24, color:C.gold, width:24, textAlign:'center' }}>{inPlayDetail.runs_scored}</span>
                <button onClick={() => upd('runs_scored', inPlayDetail.runs_scored+1)} style={{ width:32, height:32, borderRadius:4, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.05)', color:C.pri, fontSize:18, cursor:'pointer' }}>+</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record / Undo — pinned large buttons */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, paddingBottom:4 }}>
        <button
          onClick={onRecord}
          disabled={!canRecord}
          style={{
            padding:'16px', borderRadius:8, fontSize:16, fontWeight:700, letterSpacing:2,
            fontFamily:bebas, cursor: canRecord ? 'pointer' : 'not-allowed',
            border:`2px solid ${canRecord ? C.gold : C.border}`,
            background: canRecord ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.03)',
            color: canRecord ? C.gold : C.dim,
            transition:'all 0.15s',
          }}
        >⬤ RECORD PITCH</button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            padding:'16px 14px', borderRadius:8, fontSize:13, fontFamily:mono,
            border:`1px solid ${canUndo ? C.border : 'rgba(255,255,255,0.04)'}`,
            background:'transparent', color: canUndo ? C.sec : C.dim, cursor: canUndo ? 'pointer' : 'not-allowed',
          }}
        >↩ UNDO</button>
      </div>
    </div>
  )
}

// ── AI TAB ────────────────────────────────────────────────────────────────────
function AITab({ recommendations, signals, pci, reverseSwitch, onApplyRec, aiSource='rule', aiLoading=false, aiTrigger=null }) {
  return (
    <div style={{ flex:1, overflow:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:12 }}>

      {/* PCI */}
      {pci && (
        <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontFamily:mono, fontSize:8, letterSpacing:2, color:C.dim }}>PCI</span>
            <span style={{ fontFamily:bebas, fontSize:32, color:C.gold, lineHeight:1 }}>{pci.score}</span>
            <div style={{ flex:1 }}>
              <div style={{ height:6, background:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pci.score}%`, background:'linear-gradient(90deg,#FF4D6A,#F5A623,#00E5A0)', borderRadius:3 }}/>
              </div>
              <div style={{ fontFamily:mono, fontSize:8, color:C.sec, marginTop:3, letterSpacing:1 }}>{pci.label}</div>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Switch */}
      {reverseSwitch?.active && (
        <div style={{ padding:'10px 12px', background:'rgba(167,139,250,0.07)', borderRadius:8, border:`2px solid rgba(167,139,250,0.3)` }}>
          <div style={{ fontFamily:mono, fontSize:8, letterSpacing:2, color:C.purple, marginBottom:4 }}>
            {reverseSwitch.type==='reverse' ? '⟲ REVERSE SWITCH' : '→ COUNT STRATEGY'}
          </div>
          <div style={{ fontSize:12, color:C.pri, lineHeight:1.4 }}>{reverseSwitch.rationale}</div>
          {reverseSwitch.avoid?.length > 0 && (
            <div style={{ fontFamily:mono, fontSize:8, color:C.red, marginTop:6 }}>AVOID: {reverseSwitch.avoid.join(' · ')}</div>
          )}
        </div>
      )}

      {/* Signals */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <div style={{ fontFamily:mono, fontSize:8, letterSpacing:3, color:C.dim }}>SIGNAL FEED</div>
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
            {aiLoading && <span style={{ fontFamily:mono, fontSize:7, color:C.gold }}>⟳ THINKING</span>}
            {!aiLoading && aiTrigger && aiSource==='claude' && (
              <span style={{ fontFamily:mono, fontSize:7, padding:'2px 5px', borderRadius:3, background:'rgba(245,166,35,0.12)', border:'1px solid rgba(245,166,35,0.3)', color:C.gold }}>
                {({'pre_ab':'PRE-AB','two_strike':'2-STR','three_ball':'3-BALL','third_time':'3RD TIME','hard_contact':'ADJUST','mid_ab':'MID-AB'})[aiTrigger]}
              </span>
            )}
            <span style={{
              fontFamily:mono, fontSize:7, letterSpacing:1, padding:'2px 6px', borderRadius:3,
              background: aiSource==='claude' ? 'rgba(0,229,160,0.12)' : 'rgba(61,96,128,0.15)',
              border:`1px solid ${aiSource==='claude' ? 'rgba(0,229,160,0.3)' : 'rgba(61,96,128,0.3)'}`,
              color: aiSource==='claude' ? C.green : C.dim,
            }}>
              {aiSource==='claude' ? '✦ CLAUDE' : 'RULE-BASED'}
            </span>
          </div>
        </div>
        {signals.length === 0
          ? <div style={{ fontFamily:mono, fontSize:9, color:C.dim, padding:8 }}>Record pitches to generate signals</div>
          : signals.map((s,i) => {
            const sc = s.type==='warn' ? C.red : s.type==='ok' ? C.green : C.cyan
            return (
              <div key={i} style={{ display:'flex', gap:8, padding:'8px 10px', marginBottom:4, background:C.panel, borderRadius:6, borderLeft:`3px solid ${sc}` }}>
                <span style={{ fontFamily:mono, fontSize:7, color:sc, letterSpacing:1, flexShrink:0, paddingTop:1 }}>{s.type.toUpperCase()}</span>
                <span style={{ fontSize:11, color:C.sec, lineHeight:1.4 }}>{s.text}</span>
              </div>
            )
          })
        }
      </div>

      {/* Recommendations */}
      <div>
        <div style={{ fontFamily:mono, fontSize:8, letterSpacing:3, color:C.dim, marginBottom:6 }}>AI RECOMMENDATIONS</div>
        {recommendations.length === 0
          ? <div style={{ fontFamily:mono, fontSize:9, color:C.dim, padding:8 }}>Select zone + pitch to generate recs</div>
          : recommendations.map((rec, i) => {
            const rc = i===0 ? C.gold : i===1 ? C.cyan : C.sec
            return (
              <div key={i} onClick={() => onApplyRec?.(rec)} style={{
                padding:'12px', marginBottom:6, borderRadius:8,
                border:`1px solid ${i===0 ? 'rgba(245,166,35,0.3)' : C.border}`,
                background: i===0 ? 'rgba(245,166,35,0.06)' : C.panel,
                cursor:'pointer',
              }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontFamily:mono, fontSize:9, color:rc }}>#{i+1}</span>
                    <span style={{ fontFamily:bebas, fontSize:20, color:rc, letterSpacing:2 }}>{rec.pitch}</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:bebas, fontSize:22, color:rc, lineHeight:1 }}>{rec.confidence}%</div>
                    <div style={{ fontFamily:mono, fontSize:7, color:C.dim }}>CONF</div>
                  </div>
                </div>
                <div style={{ fontFamily:mono, fontSize:8, color:C.dim, marginBottom:4 }}>ZONE: {rec.zoneName}</div>
                {rec.reasons?.map((r,j) => (
                  <div key={j} style={{ fontSize:10, color:C.sec, lineHeight:1.4 }}>› {r}</div>
                ))}
                {i===0 && <div style={{ fontFamily:mono, fontSize:8, color:C.gold, marginTop:6, letterSpacing:1 }}>TAP TO APPLY →</div>}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// ── GAME TAB ──────────────────────────────────────────────────────────────────
// ── LINEUP MODE CONFIG ─────────────────────────────────────────────────────────
const LINEUP_MODES = {
  standard:    { label: 'Standard 9',         batters: 9,  desc: 'NFHS standard — 9 bat, 9 play defense' },
  dp_flex:     { label: 'DP / Flex  (9 bat)', batters: 9,  desc: '10 on card, 9 bat — FLEX listed 10th, does not bat unless subbed for DP' },
  eh:          { label: 'EH  (10 bat)',        batters: 10, desc: '10 bat, 9 play defense — EH is offense-only, placed anywhere in order' },
  dp_flex_eh:  { label: 'DP / Flex + EH',     batters: 10, desc: '11 on card, 10 bat — FLEX listed last, does not bat unless subbed for DP' },
  free_sub:    { label: 'Free Sub / Roster',  batters: 0,  desc: 'Full roster bats — pool play / recreational rule, batting order stays fixed' },
}

function GameTab({
  balls, strikes, outs, inning, topBottom,
  on1b, on2b, on3b, onToggleBase,
  ourRuns, oppRuns, onScoreChange,
  lineup, lineupPos, onSelectBatter, onNewPA,
  subs, onSubstitute,
  lineupMode, onLineupModeChange,
  currentBatter, manualBatterName, onManualBatterName,
  batterStats, paPitches, onRoster, onPitcherChange, pitchers, pitcherName, onEndGame,
  onInningChange,
  hitterNotes = {}, onSaveNote,
}) {
  const mode = LINEUP_MODES[lineupMode] || LINEUP_MODES.standard
  const expectedBatters = mode.batters || lineup.length
  const battingLineupSize = lineupMode === 'free_sub' ? lineup.length : expectedBatters
  const flexSlot = lineupMode === 'dp_flex' ? 9 : lineupMode === 'dp_flex_eh' ? 10 : null
  return (
    <div style={{ flex:1, overflow:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>

      {/* Score + inning */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:10, padding:'10px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:2, marginBottom:2 }}>US</div>
          <div style={{ fontFamily:bebas, fontSize:40, color:C.green, lineHeight:1 }}>{ourRuns}</div>
          <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:4 }}>
            <button onClick={() => onScoreChange('our',1)}  style={btnSm(C.green)}>+</button>
            <button onClick={() => onScoreChange('our',-1)} style={btnSm(C.dim)}>−</button>
          </div>
        </div>
        <div style={{ textAlign:'center', cursor:'pointer' }} onClick={onInningChange}>
          <div style={{ fontFamily:bebas, fontSize:28, color:C.gold, lineHeight:1 }}>{inning}</div>
          <div style={{ fontFamily:mono, fontSize:8, color:C.gold, letterSpacing:1 }}>{topBottom==='top' ? '▲ TOP' : '▼ BOT'}</div>
          <div style={{ fontFamily:mono, fontSize:7, color:C.dim, marginTop:2 }}>TAP TO CHANGE</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:2, marginBottom:2 }}>THEM</div>
          <div style={{ fontFamily:bebas, fontSize:40, color:C.red, lineHeight:1 }}>{oppRuns}</div>
          <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:4 }}>
            <button onClick={() => onScoreChange('opp',1)}  style={btnSm(C.red)}>+</button>
            <button onClick={() => onScoreChange('opp',-1)} style={btnSm(C.dim)}>−</button>
          </div>
        </div>
      </div>

      {/* Count + Outs */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div style={{ padding:'10px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}`, textAlign:'center' }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim, marginBottom:4 }}>COUNT</div>
          <div style={{ fontFamily:bebas, fontSize:42, color:C.gold, lineHeight:1 }}>{balls}-{strikes}</div>
          <div style={{ display:'flex', justifyContent:'space-around', marginTop:2 }}>
            <span style={{ fontFamily:mono, fontSize:8, color:C.dim }}>BALLS</span>
            <span style={{ fontFamily:mono, fontSize:8, color:C.dim }}>STRIKES</span>
          </div>
        </div>
        <div style={{ padding:'10px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}`, textAlign:'center' }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim, marginBottom:8 }}>OUTS</div>
          <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width:22, height:22, borderRadius:'50%',
                border:`2px solid ${i < outs ? C.red : C.border}`,
                background: i < outs ? 'rgba(255,77,106,0.2)' : 'transparent',
              }}/>
            ))}
          </div>
        </div>
      </div>

      {/* Bases + Runner Controls — B-005 */}
      <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim }}>RUNNERS</div>
          <div style={{ fontFamily:mono, fontSize:7, color:C.dim }}>TAP TO TOGGLE · USE ARROWS TO MOVE</div>
        </div>
        {/* Base toggles */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
          {[['3B', on3b, '3b'],['2B', on2b, '2b'],['1B', on1b, '1b']].map(([label, active, key]) => (
            <button key={key} onClick={() => onToggleBase(key)} style={{
              padding:'12px 4px', borderRadius:6, cursor:'pointer',
              border:`2px solid ${active ? C.gold : C.border}`,
              background: active ? 'rgba(245,166,35,0.15)' : 'transparent',
              color: active ? C.gold : C.dim,
              fontFamily:bebas, fontSize:18, letterSpacing:2,
            }}>{label} {active ? '●' : '○'}</button>
          ))}
        </div>
        {/* B-005: Runner advance / steal buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
          <button
            onClick={() => onToggleBase && onToggleBase('steal_2b')}
            disabled={!on1b}
            style={{ padding:'8px 4px', borderRadius:5, border:`1px solid ${on1b ? 'rgba(0,212,255,0.4)' : C.border}`,
              background: on1b ? 'rgba(0,212,255,0.08)' : 'transparent',
              color: on1b ? C.cyan : C.dim, fontFamily:mono, fontSize:8, letterSpacing:1, cursor: on1b ? 'pointer' : 'default' }}>
            🏃 1B→2B (STEAL)
          </button>
          <button
            onClick={() => onToggleBase && onToggleBase('steal_3b')}
            disabled={!on2b}
            style={{ padding:'8px 4px', borderRadius:5, border:`1px solid ${on2b ? 'rgba(0,212,255,0.4)' : C.border}`,
              background: on2b ? 'rgba(0,212,255,0.08)' : 'transparent',
              color: on2b ? C.cyan : C.dim, fontFamily:mono, fontSize:8, letterSpacing:1, cursor: on2b ? 'pointer' : 'default' }}>
            🏃 2B→3B (STEAL)
          </button>
          <button
            onClick={() => onToggleBase && onToggleBase('steal_home')}
            disabled={!on3b}
            style={{ padding:'8px 4px', borderRadius:5, border:`1px solid ${on3b ? 'rgba(255,77,106,0.4)' : C.border}`,
              background: on3b ? 'rgba(255,77,106,0.08)' : 'transparent',
              color: on3b ? C.red : C.dim, fontFamily:mono, fontSize:8, letterSpacing:1, cursor: on3b ? 'pointer' : 'default' }}>
            🏠 3B→HOME (STEAL)
          </button>
          <button
            onClick={() => onToggleBase && onToggleBase('clear_bases')}
            style={{ padding:'8px 4px', borderRadius:5, border:`1px solid rgba(255,80,80,0.25)`,
              background:'rgba(255,80,80,0.05)',
              color:'rgba(255,80,80,0.6)', fontFamily:mono, fontSize:8, letterSpacing:1, cursor:'pointer' }}>
            ✕ CLEAR BASES
          </button>
        </div>
        {/* B-020: Caught Stealing buttons */}
        <div style={{ marginTop:6, borderTop:`1px solid ${C.border}`, paddingTop:6 }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.red, marginBottom:4 }}>CAUGHT STEALING (OUT + REMOVE RUNNER)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
            {[['1B','cs_1b', on1b],['2B','cs_2b', on2b],['3B','cs_3b', on3b]].map(([label, key, active]) => (
              <button key={key}
                onClick={() => onToggleBase && onToggleBase(key)}
                disabled={!active}
                style={{ padding:'8px 4px', borderRadius:5, cursor: active ? 'pointer' : 'default',
                  border:`1px solid ${active ? 'rgba(255,77,106,0.5)' : C.border}`,
                  background: active ? 'rgba(255,77,106,0.1)' : 'transparent',
                  color: active ? C.red : C.dim, fontFamily:mono, fontSize:8, letterSpacing:1 }}>
                CS {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lineup Mode Selector */}
      <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim, marginBottom:8 }}>LINEUP FORMAT</div>
        <select
          value={lineupMode}
          onChange={e => onLineupModeChange(e.target.value)}
          style={{ width:'100%', background:'#0A1929', border:`1px solid ${C.gold}`, color:C.gold, borderRadius:4, padding:'8px 10px', fontSize:12, fontFamily:mono, marginBottom:6, cursor:'pointer' }}
        >
          {Object.entries(LINEUP_MODES).map(([key, m]) => (
            <option key={key} value={key}>{m.label}</option>
          ))}
        </select>
        <div style={{ fontFamily:mono, fontSize:8, color:C.dim, lineHeight:1.4 }}>{mode.desc}</div>
        {/* Batting order status */}
        {lineup.length > 0 && (
          <div style={{ marginTop:6, display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ fontFamily:mono, fontSize:8 }}>
              <span style={{ color: lineup.length >= battingLineupSize ? C.green : C.amber }}>
                {lineup.length}
              </span>
              <span style={{ color:C.dim }}>
                {lineupMode === 'free_sub' ? ' players (full roster)' : ` / ${battingLineupSize} batters loaded`}
              </span>
            </div>
            {flexSlot && lineup[flexSlot - 1] && (
              <div style={{ fontFamily:mono, fontSize:7, color:C.purple, background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:3, padding:'2px 6px' }}>
                FLEX: #{lineup[flexSlot - 1].jersey} {lineup[flexSlot - 1].name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batter */}
      <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim }}>AT BAT</div>
          {lineup.length > 0 && (
            <div style={{ fontFamily:mono, fontSize:7, color:C.dim }}>
              {lineupPos + 1} / {battingLineupSize || lineup.length}
              {flexSlot && lineupPos === flexSlot - 1 && (
                <span style={{ color:C.purple, marginLeft:4 }}>FLEX</span>
              )}
            </div>
          )}
        </div>
        {lineup.length > 0 ? (
          <select value={lineupPos} onChange={e => onSelectBatter(Number(e.target.value))} style={{
            width:'100%', background:C.panel, border:`1px solid ${C.border}`, color:C.pri,
            borderRadius:4, padding:'10px', fontSize:14, fontFamily:sans, marginBottom:8,
          }}>
            {lineup.map((p, i) => {
              const isFlex = flexSlot && i === flexSlot - 1
              const isEH   = lineupMode === 'dp_flex_eh' && i === battingLineupSize - 1 && i !== flexSlot - 1
              const suffix = isFlex ? ' [FLEX]' : isEH ? ' [EH]' : ''
              return (
                <option key={p.player_id || i} value={i}>
                  {i + 1}. #{p.jersey || '?'} {p.name}{suffix}
                </option>
              )
            })}
          </select>
        ) : (
          <input placeholder="Type batter name..." value={manualBatterName} onChange={e => onManualBatterName(e.target.value)}
            style={{ width:'100%', background:C.panel, border:`1px solid ${C.border}`, color:C.pri, borderRadius:4, padding:'10px', fontSize:14, fontFamily:sans, marginBottom:8, boxSizing:'border-box' }}
          />
        )}
        {currentBatter && batterStats && (
          <div style={{ display:'flex', gap:12 }}>
            {[['PA TODAY', batterStats.paToday], ["K'S", batterStats.strikeouts], ['PITCHES', paPitches.length]].map(([l, v]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:bebas, fontSize:20, color:C.gold, lineHeight:1 }}>{v}</div>
                <div style={{ fontFamily:mono, fontSize:7, color:C.dim }}>{l}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onNewPA} style={{ marginTop:8, width:'100%', padding:'10px', borderRadius:6, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.04)', color:C.sec, fontFamily:mono, fontSize:9, letterSpacing:2, cursor:'pointer' }}>
          + NEW PA
        </button>

        {/* ── HITTER NOTES ── */}
        {currentBatter && (
          <HitterNotePanel
            batter={currentBatter}
            note={hitterNotes[currentBatter.name] || { text: '', tags: [] }}
            onSave={note => onSaveNote?.(currentBatter.name, note)}
            colors={C}
          />
        )}
      </div>

      {/* ── SUBSTITUTES ── */}
      {subs && subs.length > 0 && (
        <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim, marginBottom:8 }}>
            SUBSTITUTES <span style={{ color:C.amber }}>({subs.length})</span>
          </div>
          {subs.map(sub => (
            <div key={sub.player_id || sub.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'6px 8px', background:'rgba(255,255,255,0.02)', borderRadius:4, border:`1px solid ${C.border}` }}>
              <span style={{ fontFamily:bebas, fontSize:16, color:C.amber, minWidth:28 }}>#{sub.jersey || '?'}</span>
              <span style={{ flex:1, fontFamily:'sans-serif', fontSize:13, color:C.pri, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub.name}</span>
              <select
                defaultValue=""
                onChange={e => {
                  const idx = parseInt(e.target.value)
                  if (!isNaN(idx)) {
                    onSubstitute?.(idx, sub)
                    e.target.value = ""
                  }
                }}
                style={{ background:'#0A1929', border:`1px solid ${C.amber}`, color:C.amber, borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:mono, cursor:'pointer' }}
              >
                <option value="">SUB IN FOR →</option>
                {lineup.map((starter, idx) => (
                  <option key={idx} value={idx}>
                    {idx + 1}. #{starter.jersey || '?'} {starter.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Pitcher */}
      {pitchers?.length > 0 && (
        <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim, marginBottom:8 }}>OUR PITCHER {topBottom === 'top' ? '(PITCHING VS THEM)' : '(PITCHING VS US)'}</div>
          {pitchers.length > 1 ? (
            <select value={pitchers.find(p=>p.name===pitcherName)?.player_id||''} onChange={e=>onPitcherChange(e.target.value)} style={{
              width:'100%', background:C.panel, border:`1px solid ${C.border}`, color:C.pri, borderRadius:4, padding:'10px', fontSize:14, fontFamily:sans,
            }}>
              {pitchers.map(p => <option key={p.player_id} value={p.player_id}>⚾ #{p.jersey} {p.name}</option>)}
            </select>
          ) : (
            <div style={{ fontFamily:mono, fontSize:10, color:C.green }}>⚾ {pitcherName}</div>
          )}
        </div>
      )}

      {/* Roster button */}
      <button onClick={onRoster} style={{ padding:'14px', borderRadius:8, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.03)', color:C.sec, fontFamily:bebas, fontSize:16, letterSpacing:3, cursor:'pointer' }}>
        ⊞ ROSTER MANAGEMENT
      </button>

      {/* End Game button */}
      <button onClick={onEndGame} style={{ padding:'14px', borderRadius:8, border:'1px solid rgba(255,80,80,0.35)', background:'rgba(255,80,80,0.08)', color:'#FF5050', fontFamily:bebas, fontSize:16, letterSpacing:3, cursor:'pointer' }}>
        ⏹ END GAME
      </button>
    </div>
  )
}

function btnSm(color) {
  return {
    width:28, height:28, borderRadius:4,
    border:`1px solid ${color}40`,
    background:`${color}15`,
    color, fontSize:16, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontFamily:'sans-serif', lineHeight:1,
  }
}

// ── Main Mobile Layout ────────────────────────────────────────────────────────
export default function MobileLayout({
  // game state
  balls, strikes, outs, inning, topBottom,
  on1b, on2b, on3b, onToggleBase,
  ourRuns, oppRuns, onScoreChange,
  onInningChange,
  // lineup
  lineup, lineupPos, onSelectBatter,
  subs, onSubstitute,
  lineupMode, onLineupModeChange,
  manualBatterName, onManualBatterName,
  currentBatter, batterStats,
  hitterNotes = {}, onSaveNote,
  pitchers, pitcherName, onPitcherChange,
  // charting
  selectedZone, onSelectZone,
  selectedPitch, onSelectPitch,
  arsenal, recommendations,
  selectedOutcome, onSelectOutcome,
  inPlayDetail, onInPlayChange,
  onRecord, onUndo, canRecord, canUndo,
  paPitches, onNewPA,
  // ai
  signals, pci, reverseSwitch, onApplyRec, aiSource='rule', aiLoading=false, aiTrigger=null,
  // nav
  onRoster, onScorebook, onEndGame,
  session,
  // scorebook
  gamePitches, Scorebook, pitcher,
}) {
  const [tab, setTab] = useState('pitch')

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0, background:C.void, overflow:'hidden', position:'relative' }}>

      {/* Content area */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'pitch' && (
          <PitchTab
            selectedZone={selectedZone} onSelectZone={onSelectZone}
            selectedPitch={selectedPitch} onSelectPitch={onSelectPitch}
            arsenal={arsenal} recommendations={recommendations}
            selectedOutcome={selectedOutcome} onSelectOutcome={onSelectOutcome}
            inPlayDetail={inPlayDetail} onInPlayChange={onInPlayChange}
            onRecord={onRecord} onUndo={onUndo}
            canRecord={canRecord} canUndo={canUndo}
            balls={balls} strikes={strikes}
            paPitches={paPitches} currentBatter={currentBatter}
            outs={outs} on1b={on1b} on2b={on2b} on3b={on3b}
            inning={inning} topBottom={topBottom}
            batterStats={batterStats} pitcherName={pitcherName} gamePitches={gamePitches}
          />
        )}
        {tab === 'ai' && (
          <AITab
            recommendations={recommendations} signals={signals} aiSource={aiSource} aiLoading={aiLoading} aiTrigger={aiTrigger}
            pci={pci} reverseSwitch={reverseSwitch} onApplyRec={onApplyRec}
          />
        )}
        {tab === 'game' && (
          <GameTab
            balls={balls} strikes={strikes} outs={outs}
            inning={inning} topBottom={topBottom}
            on1b={on1b} on2b={on2b} on3b={on3b} onToggleBase={onToggleBase}
            ourRuns={ourRuns} oppRuns={oppRuns} onScoreChange={onScoreChange}
            onInningChange={onInningChange}
            lineup={lineup || []} lineupPos={lineupPos ?? 0} onSelectBatter={onSelectBatter}
            subs={subs || []} onSubstitute={onSubstitute}
            lineupMode={lineupMode || 'standard'} onLineupModeChange={onLineupModeChange}
            manualBatterName={manualBatterName || ''} onManualBatterName={onManualBatterName}
            currentBatter={currentBatter} batterStats={batterStats}
            paPitches={paPitches || []} onNewPA={onNewPA}
            pitchers={pitchers || []} pitcherName={pitcherName || ''} onPitcherChange={onPitcherChange}
            onRoster={onRoster}
            onEndGame={onEndGame}
            hitterNotes={hitterNotes || {}} onSaveNote={onSaveNote}
          />
        )}
        {tab === 'book' && (
          <div style={{ flex:1, overflow:'hidden', height:'100%' }}>
            <Scorebook
              gamePitches={gamePitches}
              lineup={lineup}
              pitcher={pitcher}
              inning={inning}
              topBottom={topBottom}
              session={session}
            />
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4,1fr)',
        background:'#0A1929',
        borderTop:'3px solid #F5A623',
        boxShadow:'0 -6px 24px rgba(0,0,0,0.8)',
        flexShrink:0,
        paddingBottom:'max(env(safe-area-inset-bottom, 12px), 12px)',
        minHeight:76,
        position:'relative', zIndex:100,
      }}>
        {TABS.map(t => {
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding:'12px 4px 8px',
                border:'none',
                background: isActive ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.02)',
                display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                cursor:'pointer',
                borderTop:`3px solid ${isActive ? C.gold : 'transparent'}`,
                transition:'all 0.15s',
                WebkitTapHighlightColor:'transparent',
                outline:'none',
              }}
            >
              <span style={{ fontSize:26, lineHeight:1 }}>{t.icon}</span>
              <span style={{
                fontFamily:mono, fontSize:11, letterSpacing:2,
                color: isActive ? C.gold : '#7BACC8',
                fontWeight: isActive ? '600' : '400',
              }}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
