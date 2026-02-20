import styles from './CenterPanel.module.css'
import { PITCH_COLORS, OUTCOME_COLORS } from '../lib/analytics'

const ZONE_ROWS = ['HIGH', 'MID', 'LOW']
const ZONE_COLS = ['IN', 'MID', 'OUT']

function ZoneCell({ row, col, selected, isAiRec, onClick }) {
  const rowClass = row === 1 ? styles.rowHigh : row === 2 ? styles.rowMid : styles.rowLow
  const isHeart = row === 2 && col === 1

  return (
    <div
      className={[
        styles.zoneCell,
        rowClass,
        isHeart ? styles.heart : '',
        selected ? styles.selected : '',
        isAiRec ? styles.aiRec : '',
      ].join(' ')}
      onClick={onClick}
    >
      {isHeart && !selected
        ? <span style={{ color: 'rgba(255,77,106,0.5)', fontSize: 10 }}>♥</span>
        : <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: selected ? 'var(--gold)' : 'var(--text-dim)' }}>
            {row}•{col}
          </span>
      }
    </div>
  )
}

function HealthBar({ stats }) {
  const metrics = [
    { label: 'STRIKE %',        value: `${stats.strikeRate}%`, color: 'var(--cyan)',  pct: stats.strikeRate },
    { label: 'FIRST PITCH K%',  value: `${stats.fps}%`,        color: 'var(--green)', pct: stats.fps },
    { label: 'WHIFF %',         value: `${stats.whiffRate}%`,  color: 'var(--amber)', pct: stats.whiffRate },
    { label: 'PITCH COUNT',     value: stats.pitchCount,        color: 'var(--text-secondary)', pct: Math.min(100, stats.pitchCount) },
  ]
  return (
    <div className={styles.healthBar}>
      {metrics.map(m => (
        <div key={m.label} className={styles.healthMetric} style={{ '--metric-color': m.color, '--metric-pct': `${m.pct}%` }}>
          <div className={styles.healthLabel}>{m.label}</div>
          <div className={styles.healthValue} style={{ color: m.color }}>{m.value}</div>
        </div>
      ))}
    </div>
  )
}

function SequenceStrip({ pitches, balls, strikes }) {
  const ABBR = { Fastball: 'FAST', Changeup: 'CHNG', Drop: 'DROP', Rise: 'RISE', Curve: 'CURV', Screw: 'SCRW', 'Drop-Curve': 'D-C' }

  return (
    <div className={styles.sequenceStrip}>
      <div className={styles.seqLabel}>PA SEQUENCE</div>
      {pitches.map((p, i) => {
        const outcomeKey = p.outcome_basic || p.outcome || ''
        const oc = OUTCOME_COLORS[outcomeKey] || { color: '#7BACC8', label: outcomeKey || '?' }
        return (
          <div key={p.pitch_id || i} className={styles.seqPitch}>
            <div className={styles.seqPip} style={{ borderColor: oc.color, background: `${oc.color}10` }}>
              <div className={styles.seqNum}>{i + 1}</div>
              <div className={styles.seqPitchName} style={{ color: oc.color }}>
                {ABBR[p.pitch_type] || p.pitch_type?.slice(0, 4)}
              </div>
              <div className={styles.seqOutcome} style={{ color: oc.color }}>
                {(oc.label || '?').slice(0, 4)}
              </div>
            </div>
            <div className={styles.seqCount}>{p.balls_before}-{p.strikes_before}</div>
          </div>
        )
      })}
      {/* Next slot */}
      <div className={styles.seqPitch}>
        <div className={styles.seqNext}>
          <span className={styles.seqNextIcon}>+</span>
        </div>
        <div className={styles.seqCountNext}>{balls}-{strikes}</div>
      </div>
      <div className={styles.seqSpacer} />
      <div className={styles.seqTotal}>
        <div className={styles.seqTotalLabel}>PA PITCHES</div>
        <div className={styles.seqTotalNum}>{pitches.length}</div>
      </div>
    </div>
  )
}

export default function CenterPanel({
  selectedZone,      // { row, col } or null
  onSelectZone,
  selectedPitch,
  onSelectPitch,
  arsenal,           // string[]
  recommendations,   // [{ pitch, zone, confidence }]
  stats,
  paPitches,
  balls, strikes,
  pitchTypeBreakdown,
}) {
  const aiRecZones = new Set(recommendations.map(r => r.zone))
  const topRec = recommendations[0]

  return (
    <div className={styles.panel}>
      <HealthBar stats={stats} />

      <div className={styles.zonePitchArea}>
        {/* Zone grid */}
        <div className={styles.zoneWrap}>
          <div className={styles.zoneTitle}>STRIKE ZONE</div>
          <div className={styles.zoneGrid}>
            {/* Column headers */}
            <div className={styles.zoneWild} />
            {ZONE_COLS.map(c => <div key={c} className={styles.zoneColLabel}>{c}</div>)}
            <div className={styles.zoneWild} />

            {/* Data rows */}
            {ZONE_ROWS.map((rowLabel, ri) => {
              const row = ri + 1
              const wildColors = ['rgba(255,77,106,0.3)', 'rgba(255,179,71,0.3)', 'rgba(0,229,160,0.3)']
              return [
                <div key={`rl-${row}`} className={styles.zoneRowLabel}>{rowLabel}</div>,
                ...ZONE_COLS.map((_, ci) => {
                  const col = ci + 1
                  const zKey = `${row}-${col}`
                  return (
                    <ZoneCell
                      key={zKey}
                      row={row} col={col}
                      selected={selectedZone?.row === row && selectedZone?.col === col}
                      isAiRec={aiRecZones.has(zKey)}
                      onClick={() => onSelectZone({ row, col })}
                    />
                  )
                }),
                <div key={`rw-${row}`} className={styles.zoneWild} style={{ fontSize: 8, color: wildColors[ri] }}>
                  {['HI','MID','LO'][ri]}
                </div>,
              ]
            })}

            {/* Bottom wild row */}
            <div className={styles.zoneWild} />
            {['IN','MID','OUT'].map((l, i) => (
              <div key={`bw-${l}`} className={styles.zoneWild} style={{ fontSize: 8, color: ['rgba(255,77,106,0.2)','rgba(0,212,255,0.2)','rgba(0,229,160,0.2)'][i] }}>{l}</div>
            ))}
            <div className={styles.zoneWild} />
          </div>

          {/* Legend */}
          <div className={styles.zoneLegend}>
            <div className={styles.legendItem}>
              <div className={styles.legendSelBox} />
              <span>SELECTED</span>
            </div>
            <div className={styles.legendItem}>
              <span style={{ color: 'var(--gold)', fontSize: 10 }}>★</span>
              <span>AI REC</span>
            </div>
            <div className={styles.legendItem}>
              <span style={{ color: 'rgba(255,77,106,0.6)', fontSize: 10 }}>♥</span>
              <span>HEART</span>
            </div>
          </div>
        </div>

        {/* Pitch selector */}
        <div className={styles.pitchSelectorWrap}>
          <div className={styles.pitchSelectorTitle}>PITCH TYPE</div>
          <div className={styles.pitchPills}>
            {arsenal.map((pt, i) => {
              const recIdx = recommendations.findIndex(r => r.pitch === pt.toUpperCase())
              const color = PITCH_COLORS[pt] || 'var(--text-secondary)'
              const isSelected = selectedPitch === pt
              const breakdown = pitchTypeBreakdown.find(b => b.type === pt)

              return (
                <div
                  key={pt}
                  className={`${styles.pitchPill} ${isSelected ? styles.pitchSelected : ''}`}
                  onClick={() => onSelectPitch(pt)}
                  style={{ '--pill-color': color }}
                >
                  <div className={styles.pitchDot} style={{ borderColor: isSelected ? color : undefined, background: isSelected ? color : undefined }} />
                  <div>
                    <div style={{ color: isSelected ? color : undefined }}>{pt}</div>
                    {recIdx === 0
                      ? <div className={styles.pitchAiHint}>★ AI #1 REC</div>
                      : recIdx > 0
                        ? <div className={styles.pitchAiHintDim}>AI #{recIdx + 1} REC</div>
                        : breakdown
                          ? <div className={styles.pitchUsage}>{breakdown.pct}% USED</div>
                          : null
                    }
                  </div>
                </div>
              )
            })}
          </div>

          {/* Arsenal usage mini bars */}
          {pitchTypeBreakdown.length > 0 && (
            <div className={styles.arsenalUsage}>
              <div className={styles.arsenalLabel}>ARSENAL USAGE</div>
              {pitchTypeBreakdown.map(b => {
                const color = PITCH_COLORS[b.type] || 'var(--text-secondary)'
                return (
                  <div key={b.type} className={styles.arsenalRow}>
                    <div className={styles.arsenalName} style={{ color }}>{b.type.slice(0, 6).toUpperCase()}</div>
                    <div className={styles.arsenalBarWrap}>
                      <div className={styles.arsenalBarFill} style={{ width: `${b.pct}%`, background: color }} />
                    </div>
                    <div className={styles.arsenalPct}>{b.pct}%</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <SequenceStrip pitches={paPitches} balls={balls} strikes={strikes} />
    </div>
  )
}
