import { useState } from 'react'

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
const INPLAY_RESULTS = ['Single','Double','Triple','Home Run','Groundout','Flyout','Lineout','Popout','Sac Fly','Fielder Choice','Error']
const FIELDERS = ['P','C','1B','2B','3B','SS','LF','CF','RF']
const LOCATIONS = ['Infield','Left','Center','Right','Deep L','Deep C','Deep R']

// ── PITCH TAB ─────────────────────────────────────────────────────────────────
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

      {/* Batter strip + stat line */}
      {currentBatter && (
        <div style={{ background:C.panel, borderRadius:6, border:`1px solid ${C.border}`, overflow:'hidden' }}>
          {/* Main batter row */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px' }}>
            <span style={{ fontFamily:bebas, fontSize:22, color:C.gold, flexShrink:0 }}>
              #{currentBatter.jersey || '?'}
            </span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.pri, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{currentBatter.name}</div>
              <div style={{ fontFamily:mono, fontSize:8, color:C.sec, letterSpacing:1 }}>
                {(currentBatter.batter_type||'unknown').toUpperCase()} · {paPitches.length}P THIS PA
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontFamily:bebas, fontSize:28, color:C.gold, letterSpacing:2, lineHeight:1 }}>{balls}-{strikes}</div>
              <div style={{ fontFamily:mono, fontSize:7, color:C.dim, letterSpacing:1 }}>COUNT</div>
            </div>
          </div>
          {/* Stat line: today's performance */}
          {batterStats && batterStats.paToday > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:0, borderTop:`1px solid ${C.border}`, padding:'5px 10px', background:'rgba(0,0,0,0.2)' }}>
              <span style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:1, marginRight:10 }}>TODAY</span>
              <span style={{ fontFamily:bebas, fontSize:16, color:C.pri, letterSpacing:1, marginRight:6 }}>
                {batterStats.hits}-{batterStats.abs}
              </span>
              {batterStats.strikeouts > 0 && (
                <span style={{ fontFamily:mono, fontSize:9, color:C.red, marginRight:6 }}>{batterStats.strikeouts}K</span>
              )}
              {batterStats.walks > 0 && (
                <span style={{ fontFamily:mono, fontSize:9, color:C.cyan, marginRight:6 }}>{batterStats.walks}BB</span>
              )}
              <span style={{ fontFamily:mono, fontSize:8, color:C.dim, marginLeft:'auto' }}>{batterStats.paToday} PA</span>
            </div>
          )}
        </div>
      )}

      {/* Pitcher + pitch count strip */}
      {pitcherName && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', background:'rgba(0,229,160,0.05)', borderRadius:6, border:`1px solid rgba(0,229,160,0.15)` }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12 }}>⚾</span>
            <span style={{ fontFamily:mono, fontSize:9, color:C.green, letterSpacing:1 }}>{pitcherName}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:bebas, fontSize:18, color:C.gold, lineHeight:1 }}>{gamePitches.length}</div>
              <div style={{ fontFamily:mono, fontSize:6, color:C.dim, letterSpacing:1 }}>PITCHES</div>
            </div>
          </div>
        </div>
      )}

      {/* Game state bar — outs + runners + inning */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
        gap:6,
      }}>
        {/* Outs */}
        <div style={{ padding:'8px 10px', background:C.panel, borderRadius:6, border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim }}>OUTS</div>
          <div style={{ display:'flex', gap:5 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width:14, height:14, borderRadius:'50%',
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
function AITab({ recommendations, signals, pci, reverseSwitch, onApplyRec }) {
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
        <div style={{ fontFamily:mono, fontSize:8, letterSpacing:3, color:C.dim, marginBottom:6 }}>SIGNAL FEED</div>
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
function GameTab({
  balls, strikes, outs, inning, topBottom,
  on1b, on2b, on3b, onToggleBase,
  ourRuns, oppRuns, onScoreChange,
  lineup, lineupPos, onSelectBatter, onNewPA,
  currentBatter, manualBatterName, onManualBatterName,
  batterStats, paPitches, onRoster, onPitcherChange, pitchers, pitcherName,
  onInningChange,
}) {
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

      {/* Bases */}
      <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim, marginBottom:8 }}>RUNNERS</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
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
      </div>

      {/* Batter */}
      <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim, marginBottom:8 }}>AT BAT</div>
        {lineup.length > 0 ? (
          <select value={lineupPos} onChange={e => onSelectBatter(Number(e.target.value))} style={{
            width:'100%', background:C.panel, border:`1px solid ${C.border}`, color:C.pri,
            borderRadius:4, padding:'10px', fontSize:14, fontFamily:sans, marginBottom:8,
          }}>
            {lineup.map((p,i) => (
              <option key={p.player_id||i} value={i}>#{p.jersey||'?'} {p.name} ({p.batter_type||'?'})</option>
            ))}
          </select>
        ) : (
          <input placeholder="Type batter name..." value={manualBatterName} onChange={e => onManualBatterName(e.target.value)}
            style={{ width:'100%', background:C.panel, border:`1px solid ${C.border}`, color:C.pri, borderRadius:4, padding:'10px', fontSize:14, fontFamily:sans, marginBottom:8, boxSizing:'border-box' }}
          />
        )}
        {currentBatter && batterStats && (
          <div style={{ display:'flex', gap:12 }}>
            {[['PA TODAY', batterStats.paToday],['K\'s', batterStats.strikeouts],['PA PITCHES', paPitches.length]].map(([l,v])=>(
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
      </div>

      {/* Pitcher */}
      {pitchers?.length > 0 && (
        <div style={{ padding:'10px 12px', background:C.panel, borderRadius:8, border:`1px solid ${C.border}` }}>
          <div style={{ fontFamily:mono, fontSize:7, letterSpacing:2, color:C.dim, marginBottom:8 }}>PITCHER</div>
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
  manualBatterName, onManualBatterName,
  currentBatter, batterStats,
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
  signals, pci, reverseSwitch, onApplyRec,
  // nav
  onRoster, onScorebook,
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
            recommendations={recommendations} signals={signals}
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
            lineup={lineup} lineupPos={lineupPos} onSelectBatter={onSelectBatter}
            manualBatterName={manualBatterName} onManualBatterName={onManualBatterName}
            currentBatter={currentBatter} batterStats={batterStats}
            paPitches={paPitches} onNewPA={onNewPA}
            pitchers={pitchers} pitcherName={pitcherName} onPitcherChange={onPitcherChange}
            onRoster={onRoster}
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
