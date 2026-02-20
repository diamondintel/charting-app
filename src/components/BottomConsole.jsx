import styles from './BottomConsole.module.css'

const OUTCOMES = [
  { code: 'B',   label: 'BALL',      color: 'var(--cyan)',   border: 'rgba(0,212,255,0.25)',   glow: 'rgba(0,212,255,0.3)' },
  { code: 'CK',  label: 'CALLED K',  color: 'var(--red)',    border: 'rgba(255,77,106,0.25)',  glow: 'rgba(255,77,106,0.3)' },
  { code: 'SK',  label: 'SWING K',   color: 'var(--red)',    border: 'rgba(255,77,106,0.25)',  glow: 'rgba(255,77,106,0.3)' },
  { code: 'F',   label: 'FOUL',      color: 'var(--amber)',  border: 'rgba(255,179,71,0.25)',  glow: 'rgba(255,179,71,0.3)' },
  { code: 'IP',  label: 'IN PLAY',   color: 'var(--green)',  border: 'rgba(0,229,160,0.25)',   glow: 'rgba(0,229,160,0.3)' },
  { code: 'HBP', label: 'HBP',       color: 'var(--purple)', border: 'rgba(167,139,250,0.25)', glow: 'rgba(167,139,250,0.3)' },
]

const INPLAY_RESULTS = ['Single','Double','Triple','Home Run','Groundout','Flyout','Lineout','Popout','Sac Fly','Fielder Choice','Error']
const FIELDERS       = ['P','C','1B','2B','3B','SS','LF','CF','RF']
const LOCATIONS      = ['Infield','Left','Center','Right','Deep L','Deep C','Deep R','Foul Terr']

export default function BottomConsole({
  selectedOutcome, onSelectOutcome,
  inPlayDetail, onInPlayChange,
  onRecord, onUndo, onNewPA, onRoster,
  pitchers, pitcherName, onPitcherChange,
  canRecord, canUndo,
}) {
  const showInPlay = selectedOutcome === 'IP'
  const upd = (key, val) => onInPlayChange({ ...inPlayDetail, [key]: val })

  return (
    <div className={styles.consoleWrap}>

      {/* ── In Play detail sheet ── */}
      {showInPlay && (
        <div className={styles.inPlaySheet}>
          <div className={styles.inPlayTitle}>IN PLAY — RESULT DETAIL</div>
          <div className={styles.inPlayRow}>

            {/* Result type */}
            <div className={styles.inPlayGroup}>
              <div className={styles.inPlayLabel}>RESULT</div>
              <div className={styles.inPlayPills}>
                {INPLAY_RESULTS.map(r => (
                  <button key={r}
                    className={`${styles.inPlayPill} ${inPlayDetail.outcome_inplay === r ? styles.inPlayPillSel : ''}`}
                    onClick={() => upd('outcome_inplay', r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Fielder */}
            <div className={styles.inPlayGroup}>
              <div className={styles.inPlayLabel}>FIELDER</div>
              <div className={styles.inPlayPills}>
                {FIELDERS.map(f => (
                  <button key={f}
                    className={`${styles.inPlayPill} ${inPlayDetail.fielder === f ? styles.inPlayPillSel : ''}`}
                    onClick={() => upd('fielder', f)}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className={styles.inPlayGroup}>
              <div className={styles.inPlayLabel}>LOCATION</div>
              <div className={styles.inPlayPills}>
                {LOCATIONS.map(l => (
                  <button key={l}
                    className={`${styles.inPlayPill} ${inPlayDetail.location === l ? styles.inPlayPillSel : ''}`}
                    onClick={() => upd('location', l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Runs + RBI */}
            <div className={styles.inPlayCounters}>
              {[['RUNS','runs_scored'],['RBI','rbi']].map(([label, key]) => (
                <div key={key} className={styles.inPlayCounter}>
                  <div className={styles.inPlayLabel}>{label}</div>
                  <div className={styles.counterRow}>
                    <button className={styles.counterBtn} onClick={() => upd(key, Math.max(0, inPlayDetail[key] - 1))}>−</button>
                    <div className={styles.counterVal}>{inPlayDetail[key]}</div>
                    <button className={styles.counterBtn} onClick={() => upd(key, inPlayDetail[key] + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ── Main console bar ── */}
      <div className={styles.console}>
        <div className={styles.separator} />

        {OUTCOMES.map(o => (
          <button key={o.code}
            className={`${styles.outcomeBtn} ${selectedOutcome === o.code ? styles.outcomeSel : ''}`}
            style={{ '--btn-color': o.color, '--btn-border': o.border, '--btn-glow': o.glow }}
            onClick={() => onSelectOutcome(o.code)}>
            {o.label}
          </button>
        ))}

        <div className={styles.divider} />

        <button
          className={`${styles.recordBtn} ${!canRecord ? styles.recordDisabled : ''}`}
          onClick={onRecord} disabled={!canRecord}>
          ⬤ RECORD PITCH
        </button>

        <div className={styles.spacer} />

        <button className={styles.utilBtn} onClick={onUndo} disabled={!canUndo}>↩ UNDO</button>
        <button className={styles.utilBtn} onClick={onNewPA}>NEW PA</button>

        {/* Pitcher switcher */}
        {pitchers?.length > 1 && (
          <select
            className={styles.pitcherSelect}
            value={pitchers.find(p => p.name === pitcherName)?.player_id || ''}
            onChange={e => onPitcherChange(e.target.value)}
          >
            {pitchers.map(p => (
              <option key={p.player_id} value={p.player_id}>
                ⚾ #{p.jersey} {p.name}
              </option>
            ))}
          </select>
        )}
        {pitchers?.length === 1 && (
          <div className={styles.pitcherLabel}>⚾ {pitcherName}</div>
        )}

        <button className={styles.rosterBtn} onClick={onRoster}>⊞ ROSTER</button>

        <div className={styles.status}>
          <div className={styles.statusLabel}>SYSTEM STATUS</div>
          <div className={styles.statusRow}>
            <div className={styles.statusDot} />
            <span className={styles.statusText}>OPERATIONAL</span>
          </div>
        </div>
      </div>
    </div>
  )
}
