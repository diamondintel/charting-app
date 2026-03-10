import { useState, useEffect, useRef } from 'react'
import { decodeWristband, getNumpadRows, LOCATION_META } from '../lib/wristbandLookup'

// ── Constants ─────────────────────────────────────────────────────────────────
const OUTCOMES = [
  { code: 'B',   label: 'Ball',   color: '#3498db' },
  { code: 'CK',  label: 'Called K', color: '#e74c3c' },
  { code: 'SK',  label: 'Swing K',  color: '#e74c3c' },
  { code: 'F',   label: 'Foul',   color: '#f5c842' },
  { code: 'IP',  label: 'In Play', color: '#2ecc71' },
]

const INPLAY_HITS    = ['Single','Double','Triple','Home Run']
const INPLAY_OUTS    = ['Groundout','Flyout','Lineout','Popout','Sac Fly','Double Play','DP (FC)']
const INPLAY_OTHER   = ['Error','Fielder Choice','HBP']

// Pitch display order on numpad (matches physical wristband card top-to-bottom)
const PITCH_ORDER = ['Fastball','Changeup','Curveball','Splitter','Drop','Rise','Screwball']

// ── Sub-components ────────────────────────────────────────────────────────────

function CountDot({ filled, color }) {
  return (
    <div style={{
      width: 9, height: 9, borderRadius: '50%',
      background: filled ? color : 'transparent',
      border: `1.5px solid ${color}`,
      transition: 'all 0.15s',
    }} />
  )
}

function BaseDiamond({ on1b, on2b, on3b }) {
  const base = (filled) => ({
    width: 16, height: 16,
    transform: 'rotate(45deg)',
    background: filled ? '#f5c842' : 'transparent',
    border: `1.5px solid ${filled ? '#f5c842' : 'rgba(255,255,255,0.2)'}`,
    boxShadow: filled ? '0 0 6px rgba(245,200,66,0.6)' : 'none',
    transition: 'all 0.15s',
  })
  return (
    <div style={{ position:'relative', width:52, height:52, flexShrink:0 }}>
      {/* 2B top */}
      <div style={{ position:'absolute', top:2, left:'50%', transform:'translateX(-50%)' }}>
        <div style={base(on2b)} />
      </div>
      {/* 3B left */}
      <div style={{ position:'absolute', top:'50%', left:2, transform:'translateY(-50%)' }}>
        <div style={base(on3b)} />
      </div>
      {/* 1B right */}
      <div style={{ position:'absolute', top:'50%', right:2, transform:'translateY(-50%)' }}>
        <div style={base(on1b)} />
      </div>
      {/* Home bottom — static */}
      <div style={{ position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)' }}>
        <div style={{ width:14, height:14, transform:'rotate(45deg)', background:'rgba(255,255,255,0.08)', border:'1.5px solid rgba(255,255,255,0.15)' }} />
      </div>
    </div>
  )
}

// ── Result Overlay (slides up after numpad tap) ───────────────────────────────
function ResultOverlay({ decoded, onResult, onCancel, balls, strikes }) {
  const [inPlayOpen, setInPlayOpen] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Spring-in animation
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleResult(outcome, inPlayOutcome = null) {
    onResult(outcome, inPlayOutcome)
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: '#0d1b2e',
      borderTop: '2px solid #f5c842',
      borderRadius: '12px 12px 0 0',
      padding: '16px 16px 24px',
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1)',
    }}>
      {/* Decoded call reminder */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:'#f5c842', letterSpacing:2, lineHeight:1 }}>
          {decoded.code}
        </div>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:'#fff', letterSpacing:1 }}>
            {decoded.pitch_type}
          </div>
          <div style={{
            display:'inline-block', fontSize:9, fontWeight:700, padding:'1px 6px',
            borderRadius:3, background: decoded.color + '22', color: decoded.color,
            border: `1px solid ${decoded.color}55`,
          }}>
            {decoded.locationKey}
          </div>
        </div>
        <button onClick={onCancel} style={{
          marginLeft:'auto', background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
          color:'rgba(255,255,255,0.4)', borderRadius:6, padding:'4px 10px', cursor:'pointer',
          fontFamily:"'DM Sans',sans-serif", fontSize:12,
        }}>Cancel</button>
      </div>

      {!inPlayOpen ? (
        <>
          {/* Main outcome buttons */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:8 }}>
            {OUTCOMES.map(({ code, label, color }) => {
              // DK only valid with 2 strikes
              if (code === 'DK' && strikes < 2) return null
              return (
                <button key={code}
                  onTouchStart={() => {}} // touchstart for instant response
                  onClick={() => code === 'IP' ? setInPlayOpen(true) : handleResult(code)}
                  style={{
                    background: color + '20',
                    border: `1.5px solid ${color}`,
                    borderRadius: 8, padding: '12px 4px',
                    color, fontFamily:"'Bebas Neue',sans-serif",
                    fontSize: 16, letterSpacing: 1, cursor:'pointer',
                    touchAction:'manipulation',
                    WebkitTapHighlightColor:'transparent',
                    transition:'transform 0.1s',
                    active: { transform:'scale(0.92)' },
                  }}
                  onMouseDown={e => e.currentTarget.style.transform='scale(0.92)'}
                  onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
                  onTouchEnd={e => { e.currentTarget.style.transform='scale(1)' }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {/* WP / PB / DK row */}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            {[
              { code:'WP', label:'Wild Pitch', color:'#7a8299' },
              { code:'PB', label:'Passed Ball', color:'#7a8299' },
              ...(strikes === 2 ? [{ code:'DK', label:"Drop'd 3rd", color:'#e74c3c' }] : []),
            ].map(({ code, label, color }) => (
              <button key={code} onClick={() => handleResult(code)} style={{
                flex:1, background: color + '15', border:`1px solid ${color}55`,
                borderRadius:6, padding:'8px 4px', color,
                fontFamily:"'DM Sans',sans-serif", fontSize:12, cursor:'pointer',
                touchAction:'manipulation', WebkitTapHighlightColor:'transparent',
              }}>
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        /* In-Play sub-menu */
        <div>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, letterSpacing:2, color:'#7a8299', marginBottom:8 }}>
            IN PLAY — SELECT RESULT
          </div>
          {[
            { group:'HITS', items: INPLAY_HITS,  color:'#2ecc71' },
            { group:'OUTS', items: INPLAY_OUTS,  color:'#e74c3c' },
            { group:'OTHER', items: INPLAY_OTHER, color:'#7a8299' },
          ].map(({ group, items, color }) => (
            <div key={group} style={{ marginBottom:8 }}>
              <div style={{ fontSize:8, letterSpacing:2, color:'#555', fontFamily:"'Share Tech Mono',monospace", marginBottom:4 }}>
                {group}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {items.map(result => (
                  <button key={result} onClick={() => handleResult('IP', result)} style={{
                    background: color + '18', border:`1.5px solid ${color}55`,
                    borderRadius:6, padding:'8px 12px', color,
                    fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600,
                    cursor:'pointer', touchAction:'manipulation', WebkitTapHighlightColor:'transparent',
                  }}>
                    {result}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setInPlayOpen(false)} style={{
            marginTop:4, background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
            color:'rgba(255,255,255,0.4)', borderRadius:6, padding:'6px 12px',
            cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontSize:12,
          }}>← Back</button>
        </div>
      )}
    </div>
  )
}

// ── Main RapidFireLayout ──────────────────────────────────────────────────────
export default function RapidFireLayout({
  // Game state (from sharedProps)
  balls, strikes, outs, inning, topBottom,
  on1b, on2b, on3b,
  ourRuns, oppRuns,
  lineup, lineupPos, onSelectBatter,
  currentBatter,
  pitcherName,
  // Charting state setters (from sharedProps)
  onSelectZone, onSelectPitch, onSelectOutcome, onInPlayChange,
  onRecord, onUndo,
  canUndo,
  paPitches,
  session,
  // Mode
  rfSequence = 'odd',      // 'odd' | 'even'
  onSequenceChange,
}) {
  const [selectedCode, setSelectedCode]   = useState(null)  // currently tapped wristband code
  const [showOverlay, setShowOverlay]     = useState(false)
  const [lastPitch, setLastPitch]         = useState(null)  // most recent decoded pitch for display

  const numpadRows = getNumpadRows(rfSequence)

  // Debug: log what rows we got so we can see in console
  // eslint-disable-next-line no-console
  console.log('[RF] numpadRows keys:', Object.keys(numpadRows), 'seq:', rfSequence)

  // ── Handle numpad tap ─────────────────────────────────────────────────────
  function handleCodeTap(code) {
    const decoded = decodeWristband(code)
    if (!decoded) return

    // Set zone + pitch type in App state so handleRecord() has what it needs
    onSelectZone({ row: decoded.zone_row, col: decoded.zone_col })
    onSelectPitch(decoded.pitch_type)

    setSelectedCode(code)
    setShowOverlay(true)
  }

  // ── Handle result selection ───────────────────────────────────────────────
  async function handleResult(outcome, inPlayOutcome = null) {
    // Set outcome in App state
    onSelectOutcome(outcome)

    // If In Play, set inPlayDetail too
    if (outcome === 'IP' && inPlayOutcome) {
      onInPlayChange(prev => ({ ...prev, outcome_inplay: inPlayOutcome }))
    }

    // Close overlay immediately for responsiveness
    setShowOverlay(false)
    const decoded = decodeWristband(selectedCode)
    setLastPitch({ ...decoded, outcome, inPlayOutcome })
    setSelectedCode(null)

    // Small tick to let React flush the state setters above before handleRecord reads them
    await new Promise(r => setTimeout(r, 20))
    onRecord()
  }

  function handleCancelOverlay() {
    setShowOverlay(false)
    setSelectedCode(null)
    onSelectZone(null)
    onSelectPitch(null)
    onSelectOutcome(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const decoded = selectedCode ? decodeWristband(selectedCode) : null

  return (
    <div style={{
      display:'flex', flexDirection:'column', flex:1, overflow:'hidden',
      background:'#0a0f1e', position:'relative',
      fontFamily:"'DM Sans',sans-serif",
    }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'8px 12px',
        background:'#111827', borderBottom:'1px solid #1a2540', flexShrink:0,
      }}>
        {/* Mode badge */}
        <div style={{
          fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:2.5,
          color:'#f5c842', border:'1px solid rgba(245,200,66,0.3)',
          borderRadius:3, padding:'2px 7px',
        }}>
          RAPID FIRE
        </div>

        {/* Batter */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:'#e8eaf0',
            letterSpacing:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {currentBatter?.name || '—'}
          </div>
        </div>

        {/* Count dots */}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ display:'flex', gap:3 }}>
            {[0,1,2,3].map(i => <CountDot key={i} filled={i < balls}   color='#2ecc71' />)}
          </div>
          <div style={{ display:'flex', gap:3 }}>
            {[0,1,2].map(i => <CountDot key={i} filled={i < strikes} color='#e74c3c' />)}
          </div>
        </div>

        {/* Outs */}
        <div style={{ display:'flex', gap:3 }}>
          {[0,1,2].map(i => <CountDot key={i} filled={i < outs} color='#f59e0b' />)}
        </div>

        {/* Sequence toggle */}
        <button onClick={() => onSequenceChange?.(rfSequence === 'odd' ? 'even' : 'odd')} style={{
          fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1.5,
          background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
          color: rfSequence === 'odd' ? '#e74c3c' : '#3498db',
          borderRadius:4, padding:'3px 8px', cursor:'pointer',
        }}>
          {rfSequence.toUpperCase()}
        </button>
      </div>

      {/* ── Main body: numpad + right panel ──────────────────────────────── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* LEFT: Numpad */}
        <div style={{
          flex:1, overflowY:'auto', padding:'8px 6px',
          display:'flex', flexDirection:'column', gap:4,
        }}>
          {PITCH_ORDER.map(pitchType => {
            const row = numpadRows[pitchType]
            if (!row) return null
            return (
              <div key={pitchType} style={{ display:'flex', gap:4, alignItems:'stretch' }}>
                {/* Pitch label */}
                <div style={{
                  width:54, flexShrink:0, display:'flex', alignItems:'center',
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:'#7a8299',
                  letterSpacing:0.5,
                }}>
                  {pitchType}
                </div>

                {/* 4 location buttons */}
                {row.map(entry => {
                  const isSelected = selectedCode === entry.code
                  return (
                    <button
                      key={entry.code}
                      onClick={() => handleCodeTap(entry.code)}
                      style={{
                        flex:1, minHeight:52,
                        background: isSelected ? entry.color + '30' : '#1a2540',
                        border: `${isSelected ? 2 : 1.5}px solid ${isSelected ? entry.color : entry.color + '60'}`,
                        borderRadius:8,
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        gap:2, cursor:'pointer',
                        boxShadow: isSelected ? `0 0 10px ${entry.color}50` : 'none',
                        transition:'all 0.1s',
                        touchAction:'manipulation',
                        WebkitTapHighlightColor:'transparent',
                      }}
                      onMouseDown={e => e.currentTarget.style.transform='scale(0.92)'}
                      onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
                      onTouchEnd={e => e.currentTarget.style.transform='scale(1)'}
                    >
                      <div style={{
                        fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:'#e8eaf0',
                        letterSpacing:1, lineHeight:1,
                      }}>
                        {entry.code}
                      </div>
                      <div style={{ fontSize:7, color: entry.color, fontWeight:700, letterSpacing:0.5 }}>
                        {entry.locationKey}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* RIGHT: Decoded call + diamond + pitch history */}
        <div style={{
          width:200, flexShrink:0, borderLeft:'1px solid #1a2540',
          display:'flex', flexDirection:'column', padding:'10px 10px',
          gap:12, background:'#0d1520',
        }}>

          {/* Decoded call display */}
          <div style={{
            background:'#111827', borderRadius:8, padding:'10px 12px',
            border:'1px solid #1a2540', minHeight:80,
            display:'flex', flexDirection:'column', gap:4,
          }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:2, color:'#3d5070' }}>
              CALL
            </div>
            {lastPitch ? (
              <>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:44, color:'#f5c842', letterSpacing:2, lineHeight:1 }}>
                  {lastPitch.code}
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:'#e8eaf0', letterSpacing:1 }}>
                  {lastPitch.pitch_type}
                </div>
                <div style={{
                  display:'inline-flex', alignItems:'center', gap:4,
                  fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:3,
                  background: lastPitch.color + '22', color: lastPitch.color,
                  border:`1px solid ${lastPitch.color}55`, alignSelf:'flex-start',
                }}>
                  {lastPitch.locationKey}
                </div>
              </>
            ) : (
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'#2a3550', marginTop:8 }}>
                TAP A CODE
              </div>
            )}
          </div>

          {/* Base diamond */}
          <div style={{ display:'flex', justifyContent:'center' }}>
            <BaseDiamond on1b={on1b} on2b={on2b} on3b={on3b} />
          </div>

          {/* Score + inning */}
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:'#f5c842', letterSpacing:1 }}>
              {ourRuns} – {oppRuns}
            </div>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'#7a8299', letterSpacing:1 }}>
              INN {inning} {topBottom === 'top' ? '▲' : '▼'}
            </div>
          </div>

          {/* This PA pitch history */}
          <div style={{ flex:1, overflowY:'auto' }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, letterSpacing:2, color:'#3d5070', marginBottom:6 }}>
              THIS PA
            </div>
            {paPitches.length === 0 ? (
              <div style={{ fontSize:10, color:'#2a3550', fontFamily:"'Share Tech Mono',monospace" }}>—</div>
            ) : (
              paPitches.map((p, i) => {
                const outcomeColor = { B:'#3498db', CK:'#e74c3c', SK:'#e74c3c', F:'#f5c842', IP:'#2ecc71', HBP:'#9b59b6', WP:'#7a8299', PB:'#7a8299', DK:'#e74c3c' }[p.outcome_basic] || '#7a8299'
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:8, color:'#3d5070', width:12 }}>
                      {i+1}
                    </div>
                    <div style={{ fontSize:10, color:'#e8eaf0', flex:1, fontFamily:"'DM Sans',sans-serif" }}>
                      {p.pitch_type}
                    </div>
                    <div style={{
                      fontFamily:"'Share Tech Mono',monospace", fontSize:9, fontWeight:700,
                      color: outcomeColor,
                    }}>
                      {p.outcome_basic}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Undo */}
          {canUndo && (
            <button onClick={onUndo} style={{
              background:'rgba(231,76,60,0.1)', border:'1px solid rgba(231,76,60,0.3)',
              color:'#e74c3c', borderRadius:6, padding:'6px', fontSize:11,
              fontFamily:"'DM Sans',sans-serif", cursor:'pointer',
              touchAction:'manipulation',
            }}>
              ↩ Undo
            </button>
          )}
        </div>
      </div>

      {/* ── Result overlay (slides up) ────────────────────────────────────── */}
      {showOverlay && decoded && (
        <ResultOverlay
          decoded={decoded}
          balls={balls}
          strikes={strikes}
          onResult={handleResult}
          onCancel={handleCancelOverlay}
        />
      )}
    </div>
  )
}
