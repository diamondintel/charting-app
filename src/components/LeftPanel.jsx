import styles from './LeftPanel.module.css'
import { generateSignals } from '../lib/analytics'

function BaseDiamond({ on1b, on2b, on3b }) {
  return (
    <div className={styles.diamondWrap}>
      <div className={styles.diamond}>
        <div className={styles.diamondField} />
        <div className={`${styles.base} ${styles.home}`} />
        <div className={`${styles.base} ${styles.first}  ${on1b ? styles.occupied : ''}`} />
        <div className={`${styles.base} ${styles.second} ${on2b ? styles.occupied : ''}`} />
        <div className={`${styles.base} ${styles.third}  ${on3b ? styles.occupied : ''}`} />
      </div>
      <div className={styles.baseLabels}>
        <span className={on3b ? styles.baseLabelOn : styles.baseLabelOff}>3RD</span>
        <span className={on2b ? styles.baseLabelOn : styles.baseLabelOff}>2ND</span>
        <span className={on1b ? styles.baseLabelOn : styles.baseLabelOff}>1ST</span>
      </div>
    </div>
  )
}

const BATTER_TYPE_COLORS = {
  power:   { bg: 'rgba(255,77,106,0.15)',  border: 'rgba(255,77,106,0.4)',  color: '#FF4D6A' },
  contact: { bg: 'rgba(0,212,255,0.12)',   border: 'rgba(0,212,255,0.4)',   color: '#00D4FF' },
  slapper: { bg: 'rgba(0,229,160,0.12)',   border: 'rgba(0,229,160,0.4)',   color: '#00E5A0' },
  unknown: { bg: 'rgba(61,96,128,0.2)',    border: 'rgba(61,96,128,0.4)',   color: '#7BACC8' },
}

const LINEUP_MODES = {
  standard:   { label: 'Standard 9',        batters: 9  },
  dp_flex:    { label: 'DP / Flex (9 bat)', batters: 9  },
  eh:         { label: 'EH (10 bat)',        batters: 10 },
  dp_flex_eh: { label: 'DP / Flex + EH',    batters: 10 },
  free_sub:   { label: 'Free Sub / Roster', batters: 0  },
}

export default function LeftPanel({
  balls, strikes, outs,
  on1b, on2b, on3b,
  onToggleBase,
  currentBatter,
  lineup,
  lineupPos,
  onSelectBatter,
  manualBatterName,
  onManualBatterName,
  paPitches,
  batterStats,
  lineupMode = 'standard',
  onLineupModeChange,
}) {
  const signals = generateSignals(paPitches, balls, strikes, currentBatter?.batter_type)
  const tc = BATTER_TYPE_COLORS[currentBatter?.batter_type || 'unknown']

  return (
    <div className={styles.panel}>

      {/* ── COUNT ── */}
      <div className={styles.section}>
        <div className="section-label">COUNT</div>
        <div className={styles.countDisplay}>
          <span className={styles.countMain}>{balls}-{strikes}</span>
        </div>
        <div className={styles.countLabelRow}>
          <span className={styles.countSub}>BALLS</span>
          <span className={styles.countSub}>STRIKES</span>
        </div>
        <div className={styles.outsRow}>
          <span className={styles.outsLabel}>OUTS</span>
          {[0,1,2].map(i => (
            <div key={i} className={`${styles.outPip} ${i < outs ? styles.outActive : ''}`} />
          ))}
        </div>
      </div>

      {/* ── RUNNERS ── */}
      <div className={styles.section}>
        <div className="section-label">RUNNERS</div>
        <BaseDiamond on1b={on1b} on2b={on2b} on3b={on3b} />
        <div className={styles.baseToggleRow}>
          {[['3B', on3b, '3b'], ['2B', on2b, '2b'], ['1B', on1b, '1b']].map(([label, active, key]) => (
            <button
              key={key}
              className={`${styles.baseToggle} ${active ? styles.baseToggleOn : ''}`}
              onClick={() => onToggleBase(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LINEUP FORMAT ── */}
      <div className={styles.section}>
        <div className="section-label">LINEUP FORMAT</div>
        <select
          className={styles.batterSelect}
          value={lineupMode}
          onChange={e => onLineupModeChange?.(e.target.value)}
          style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
        >
          {Object.entries(LINEUP_MODES).map(([key, m]) => (
            <option key={key} value={key}>{m.label}</option>
          ))}
        </select>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
          {lineup.length > 0 && (
            <>
              <span style={{ color: lineup.length >= (LINEUP_MODES[lineupMode]?.batters || lineup.length) ? 'var(--green)' : 'var(--amber)' }}>
                {lineup.length}
              </span>
              {lineupMode === 'free_sub'
                ? ' players (full roster)'
                : ` / ${LINEUP_MODES[lineupMode]?.batters || '?'} batters loaded`}
            </>
          )}
        </div>
      </div>

      {/* ── AT BAT ── */}
      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-label" style={{ marginBottom: 0 }}>AT BAT</div>
          {lineup.length > 0 && (
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'var(--text-dim)' }}>
              {lineupPos + 1}&nbsp;/&nbsp;{lineupMode === 'free_sub' ? lineup.length : (LINEUP_MODES[lineupMode]?.batters || lineup.length)}
              {lineupMode === 'dp_flex' && lineupPos === 9 && <span style={{ color: 'var(--purple)', marginLeft: 4 }}>FLEX</span>}
              {lineupMode === 'dp_flex_eh' && lineupPos === 10 && <span style={{ color: 'var(--purple)', marginLeft: 4 }}>FLEX</span>}
            </div>
          )}
        </div>
        <div style={{ marginTop: 6 }} />

        {lineup.length > 0 ? (
          <select
            className={styles.batterSelect}
            value={lineupPos}
            onChange={e => onSelectBatter(Number(e.target.value))}
          >
            {lineup.map((p, i) => {
              const isFlex = (lineupMode === 'dp_flex' && i === 9) || (lineupMode === 'dp_flex_eh' && i === 10)
              const isEH   = lineupMode === 'dp_flex_eh' && i === 9
              const suffix = isFlex ? ' [FLEX]' : isEH ? ' [EH]' : ''
              return (
                <option key={p.player_id || i} value={i}>
                  {i + 1}. #{p.jersey || '?'} {p.name}{suffix}
                </option>
              )
            })}
          </select>
        ) : (
          <input
            className={styles.batterInput}
            placeholder="Type batter name..."
            value={manualBatterName}
            onChange={e => onManualBatterName(e.target.value)}
          />
        )}

        {currentBatter && (
          <div className={styles.batterCard} style={{ borderLeftColor: tc.color }}>
            <div className={styles.batterHeader}>
              <div className={styles.batterNumber} style={{ color: tc.color }}>
                #{currentBatter.jersey || '—'}
              </div>
              <div className={styles.batterInfo}>
                <div className={styles.batterName}>{currentBatter.name}</div>
                <div className={styles.batterMeta}>#{lineupPos + 1}-SPOT</div>
              </div>
              <div className={styles.batterTypePill} style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color }}>
                {(currentBatter.batter_type || 'unknown').toUpperCase()}
              </div>
            </div>
            {batterStats && (
              <div className={styles.batterStatsRow}>
                <div className={styles.batterStat}>
                  <div className={styles.statVal}>{batterStats.paToday}</div>
                  <div className={styles.statLbl}>PA TODAY</div>
                </div>
                <div className={styles.batterStat}>
                  <div className={styles.statVal} style={{ color: '#FF4D6A' }}>{batterStats.strikeouts}K</div>
                  <div className={styles.statLbl}>TODAY K</div>
                </div>
                <div className={styles.batterStat}>
                  <div className={styles.statVal}>{paPitches.length}</div>
                  <div className={styles.statLbl}>PA PITCHES</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SIGNAL FEED ── */}
      <div className={`${styles.section} ${styles.signalSection}`}>
        <div className="section-label">SIGNAL FEED</div>
        <div className={styles.signalFeed}>
          {signals.length === 0 && (
            <div className={styles.signalEmpty}>Record pitches to generate signals</div>
          )}
          {signals.map((s, i) => (
            <div key={i} className={`${styles.signalItem} ${styles[s.type]}`}>
              <span className={`${styles.signalBadge} ${styles[s.type]}`}>
                {s.type.toUpperCase()}
              </span>
              <span className={styles.signalText}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
